"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formatDateID, DAY_MS } from "@/lib/recruitment/format";
import type {
  Activity,
  Candidate,
  Interview,
  Job,
  NewJobInput,
  RecruitmentSnapshot,
} from "@/lib/recruitment/types";
import { RATING_INIT, TODO_INIT, type RatingKey, type TodoItem } from "@/lib/data";

type RecruitmentContextValue = {
  jobs: Job[];
  candidates: Candidate[];
  interviews: Interview[];
  activities: Activity[];
  jobF: string;
  setJobF: (value: string) => void;
  candQ: string;
  setCandQ: (value: string) => void;
  candStage: string;
  setCandStage: (value: string) => void;
  pipeFilter: string;
  setPipeFilter: (value: string) => void;
  rating: Record<RatingKey, number>;
  setRating: (key: RatingKey, value: number) => void;
  rec: string;
  setRec: (value: string) => void;
  selSch: number;
  setSelSch: (value: number) => void;
  selO: number;
  setSelO: (value: number) => void;
  todo: TodoItem[];
  toggleTodo: (index: number) => void;
  khCat: string;
  setKhCat: (value: string) => void;
  khQ: string;
  setKhQ: (value: string) => void;
  jobModalOpen: boolean;
  closeModalOpen: boolean;
  closeJobId: number | null;
  drawerId: number | null;
  toastOn: boolean;
  toastMsg: string;
  stagesPick: boolean[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggleStagePick: (index: number) => void;
  openJobModal: () => void;
  closeModals: () => void;
  askClose: (id: number) => void;
  doClose: () => void;
  createJob: (input: NewJobInput) => void;
  openCand: (id: number) => void;
  closeD: () => void;
  moveC: (id: number, stage: string) => void;
  toast: (message: string) => void;
};

const RecruitmentContext = createContext<RecruitmentContextValue | null>(null);

export function RecruitmentProvider({
  initial,
  children,
}: {
  initial: RecruitmentSnapshot;
  children: ReactNode;
}) {
  const [jobs, setJobs] = useState<Job[]>(initial.jobs);
  const [candidates, setCandidates] = useState<Candidate[]>(
    initial.candidates
  );
  const [interviews, setInterviews] = useState<Interview[]>(
    initial.interviews
  );
  const [activities, setActivities] = useState<Activity[]>(
    initial.activities
  );
  const [jobF, setJobF] = useState("Semua");
  const [candQ, setCandQ] = useState("");
  const [candStage, setCandStage] = useState("Semua");
  const [pipeFilter, setPipeFilter] = useState("Semua");
  const [rating, setRatingState] =
    useState<Record<RatingKey, number>>(RATING_INIT);
  const [rec, setRec] = useState("Lanjut");
  const [selSch, setSelSch] = useState(0);
  const [selO, setSelO] = useState(0);
  const [todo, setTodo] = useState<TodoItem[]>(TODO_INIT);
  const [khCat, setKhCat] = useState("Semua");
  const [khQ, setKhQ] = useState("");
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeJobId, setCloseJobId] = useState<number | null>(null);
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [stagesPick, setStagesPick] = useState([
    true,
    true,
    true,
    false,
    true,
  ]);
  const [toastMsg, setToastMsg] = useState("");
  const [toastOn, setToastOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const toast = useCallback((message: string) => {
    setToastMsg(message);
    setToastOn(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastOn(false), 2400);
  }, []);

  const logActivity = useCallback(
    (actor: string, before: string, subject: string, after: string) => {
      setActivities((prev) => [
        {
          id: `local-${Date.now()}-${prev.length}`,
          actor,
          before,
          subject,
          after,
          at: new Date().toISOString(),
          label: "baru saja",
        },
        ...prev,
      ]);
    },
    []
  );

  /** Ambil ulang snapshot dari lapisan data (API/database), dipakai retry. */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/recruitment", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Permintaan gagal (HTTP ${response.status})`);
      }
      const snapshot = (await response.json()) as RecruitmentSnapshot;
      setJobs(snapshot.jobs);
      setCandidates(snapshot.candidates);
      setInterviews(snapshot.interviews);
      setActivities(snapshot.activities);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat data rekrutmen"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const openJobModal = () => setJobModalOpen(true);

  const closeModals = () => {
    setJobModalOpen(false);
    setCloseModalOpen(false);
  };

  const createJob = useCallback(
    (input: NewJobInput) => {
      const now = new Date();
      const isPublished = input.st === "Aktif";
      setJobs((prev) => [
        {
          id: Date.now(),
          pos: input.pos,
          dep: input.dep,
          st: input.st,
          n: input.n ?? 0,
          pub: isPublished ? formatDateID(now) : "—",
          dl: isPublished
            ? formatDateID(new Date(now.getTime() + 30 * DAY_MS))
            : "—",
          publishedAt: isPublished ? now.toISOString() : null,
        },
        ...prev,
      ]);
      logActivity(
        "Ardo",
        " membuat lowongan ",
        input.pos,
        isPublished ? " dan mempublikasikannya" : " sebagai draf"
      );
      toast(
        isPublished
          ? `Lowongan "${input.pos}" dipublikasikan`
          : `Draf lowongan "${input.pos}" disimpan`
      );
    },
    [logActivity, toast]
  );

  const askClose = (id: number) => {
    setCloseJobId(id);
    setCloseModalOpen(true);
  };

  const doClose = () => {
    if (closeJobId === null) return;
    setJobs((prev) =>
      prev.map((job) =>
        job.id === closeJobId ? { ...job, st: "Ditutup" } : job
      )
    );
    closeModals();
    toast("Lowongan ditutup (simulasi)");
  };

  const openCand = (id: number) => setDrawerId(id);

  const closeD = () => setDrawerId(null);

  const moveC = (id: number, stage: string) => {
    const candidate = candidates.find((item) => item.id === id);
    setCandidates((prev) =>
      prev.map((item) => (item.id === id ? { ...item, stage } : item))
    );
    setDrawerId(id);
    if (candidate) {
      logActivity("Ardo", " memindahkan ", candidate.name, ` ke ${stage}`);
      toast(`${candidate.name} dipindahkan ke ${stage}`);
    }
  };

  const setRating = (key: RatingKey, value: number) =>
    setRatingState((prev) => ({ ...prev, [key]: value }));

  const toggleTodo = (index: number) =>
    setTodo((prev) =>
      prev.map((item, i) => (i === index ? { ...item, done: !item.done } : item))
    );

  const toggleStagePick = (index: number) =>
    setStagesPick((prev) =>
      prev.map((picked, i) => (i === index ? !picked : picked))
    );

  return (
    <RecruitmentContext.Provider
      value={{
        jobs,
        candidates,
        interviews,
        activities,
        jobF,
        setJobF,
        candQ,
        setCandQ,
        candStage,
        setCandStage,
        pipeFilter,
        setPipeFilter,
        rating,
        setRating,
        rec,
        setRec,
        selSch,
        setSelSch,
        selO,
        setSelO,
        todo,
        toggleTodo,
        khCat,
        setKhCat,
        khQ,
        setKhQ,
        jobModalOpen,
        closeModalOpen,
        closeJobId,
        drawerId,
        toastOn,
        toastMsg,
        stagesPick,
        loading,
        error,
        refresh,
        toggleStagePick,
        openJobModal,
        closeModals,
        askClose,
        doClose,
        createJob,
        openCand,
        closeD,
        moveC,
        toast,
      }}
    >
      {children}
    </RecruitmentContext.Provider>
  );
}

export function useRecruitment() {
  const context = useContext(RecruitmentContext);
  if (!context) {
    throw new Error("useRecruitment must be used inside RecruitmentProvider");
  }
  return context;
}
