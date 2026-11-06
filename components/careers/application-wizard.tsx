"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import {
  AVAILABILITIES,
  EDUCATIONS,
  EXPERIENCE_LENGTHS,
  MAX_CV_BYTES,
  SKILLS,
  SOURCES,
  type ApplicationDraft,
  type FieldErrors,
  type PublicJob,
} from "@/lib/recruitment/live/types";
import {
  normalizeWhatsapp,
  validateApplicationStep,
} from "@/lib/recruitment/live/validation";
import {
  applicationStorageKey,
  emptyApplication,
  experienceLabels,
  restoreApplication,
} from "./application-draft";
import { ApplicationSuccess } from "./application-success";
import { CareerIcon } from "./primitives";
import styles from "./careers.module.css";

const stepNames = ["Data Diri", "Pengalaman", "Upload CV & Kirim"];
const firstStepFields = [
  "full_name",
  "whatsapp",
  "email",
  "birth_date",
  "city",
  "education",
];
const secondStepFields = [
  "has_admin_experience",
  "last_position",
  "last_company",
  "experience_length",
  "skills",
  "expected_salary",
  "start_availability",
  "source",
];

function ErrorText({ name, errors }: { name: string; errors: FieldErrors }) {
  return errors[name] ? (
    <p id={`${name}-error`} className={styles.error}>
      {errors[name]}
    </p>
  ) : null;
}

function Required() {
  return <span className={styles.required}>*</span>;
}

function Choices({
  name,
  label,
  required,
  children,
  errors,
  className = "",
  helper,
}: {
  name: string;
  label: string;
  required?: boolean;
  children: ReactNode;
  errors: FieldErrors;
  className?: string;
  helper?: string;
}) {
  return (
    <fieldset
      className={`${styles.choices} ${className}`}
      tabIndex={-1}
      aria-invalid={Boolean(errors[name])}
      aria-describedby={errors[name] ? `${name}-error` : undefined}
    >
      <legend>
        {label} {required && <Required />}
      </legend>
      {helper && <p>{helper}</p>}
      {children}
      <ErrorText name={name} errors={errors} />
    </fieldset>
  );
}

function Choice({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${selected ? styles.selected : ""}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TextField({
  name,
  label,
  required,
  optional,
  prefix,
  helper,
  errors,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "prefix"> & {
  name: string;
  label: string;
  optional?: boolean;
  prefix?: string;
  helper?: string;
  errors: FieldErrors;
}) {
  const control = (
    <input
      {...input}
      id={name}
      name={name}
      required={required}
      className={`${styles.input} ${errors[name] ? styles.invalid : ""}`}
      aria-invalid={Boolean(errors[name])}
      aria-describedby={
        [helper ? `${name}-helper` : "", errors[name] ? `${name}-error` : ""]
          .filter(Boolean)
          .join(" ") || undefined
      }
    />
  );
  return (
    <div className={styles.field}>
      <label htmlFor={name}>
        {label} {required && <Required />}
        {optional && <span className={styles.optional}>(opsional)</span>}
      </label>
      {prefix ? (
        <div
          className={`${styles.prefixInput} ${errors[name] ? styles.invalid : ""}`}
        >
          <span>{prefix}</span>
          {control}
        </div>
      ) : (
        control
      )}
      {helper && (
        <span id={`${name}-helper`} className={styles.helper}>
          {helper}
        </span>
      )}
      <ErrorText name={name} errors={errors} />
    </div>
  );
}

function fileError(file: File | null): string | null {
  if (!file) return "Pilih file CV kamu terlebih dahulu.";
  if (
    file.type !== "application/pdf" ||
    !file.name.toLowerCase().endsWith(".pdf")
  )
    return "CV harus dalam format PDF.";
  if (file.size === 0) return "File CV kosong. Pilih file PDF yang valid.";
  if (file.size > MAX_CV_BYTES) return "Ukuran CV maksimal 2 MB.";
  return null;
}

export function ApplicationWizard({ job }: { job: PublicJob }) {
  const [draft, setDraft] = useState<ApplicationDraft>(emptyApplication);
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [cv, setCv] = useState<File | null>(null);
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [applicationNumber, setApplicationNumber] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const storageKey = applicationStorageKey(job.id);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          setDraft(restoreApplication(JSON.parse(saved)));
        } catch {
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      setStorageAvailable(false);
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready || applicationNumber) return;
    try {
      const saved = { ...draft } as Partial<ApplicationDraft>;
      delete saved.consent;
      localStorage.setItem(storageKey, JSON.stringify(saved));
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }, [draft, ready, storageKey, applicationNumber]);

  function update<K extends keyof ApplicationDraft>(
    name: K,
    value: ApplicationDraft[K],
  ) {
    setDraft((current) => {
      const next = { ...current, [name]: value };
      if (name === "has_admin_experience" && value === false) {
        next.last_position = "";
        next.last_company = "";
        next.experience_length = "";
      }
      return next;
    });
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      if (name === "has_admin_experience" && value === false) {
        delete next.last_position;
        delete next.last_company;
        delete next.experience_length;
      }
      return next;
    });
    setSubmitError("");
  }

  function showStep(next: number, fieldErrors: FieldErrors = {}) {
    setStep(next);
    setErrors(fieldErrors);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
      const target = Object.keys(fieldErrors).length
        ? form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
        : form.current?.querySelector<HTMLElement>("h1");
      target?.focus({ preventScroll: true });
      if (Object.keys(fieldErrors).length)
        target?.scrollIntoView({ block: "center" });
    });
  }

  function selectCv(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    const problem = fileError(selected);
    setCv(problem ? null : selected);
    setErrors((current) => {
      const next = { ...current };
      if (problem) next.cv = problem;
      else delete next.cv;
      return next;
    });
    if (problem) event.target.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || submittingRef.current) return;
    setSubmitError("");
    if (step < 3) {
      const fieldErrors = validateApplicationStep(draft, step);
      if (Object.keys(fieldErrors).length) {
        showStep(step, fieldErrors);
        return;
      }
      showStep(step + 1);
      return;
    }
    // Earlier answers may have changed after using Back or restoring a draft.
    for (const checkStep of [1, 2]) {
      const fieldErrors = validateApplicationStep(draft, checkStep);
      if (Object.keys(fieldErrors).length) {
        showStep(checkStep, fieldErrors);
        return;
      }
    }
    const fieldErrors = validateApplicationStep(draft, 3);
    const cvProblem = fileError(cv);
    if (cvProblem) fieldErrors.cv = cvProblem;
    if (Object.keys(fieldErrors).length) {
      showStep(3, fieldErrors);
      return;
    }
    if (!cv || !draft.consent) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const body = new FormData();
      body.set("data", JSON.stringify({ ...draft, job_id: job.id, website }));
      body.set("cv", cv);
      const response = await fetch("/api/karir/lamaran", {
        method: "POST",
        body,
      });
      const result: unknown = await response.json().catch(() => null);
      const payload =
        result && typeof result === "object"
          ? (result as Record<string, unknown>)
          : {};
      if (
        response.status !== 201 ||
        typeof payload.application_number !== "string" ||
        !payload.application_number
      ) {
        const serverErrors: FieldErrors = {};
        if (
          payload.fields &&
          typeof payload.fields === "object" &&
          !Array.isArray(payload.fields)
        ) {
          for (const [key, value] of Object.entries(payload.fields))
            if (typeof value === "string") serverErrors[key] = value;
        }
        const targetStep = firstStepFields.some((key) => serverErrors[key])
          ? 1
          : secondStepFields.some((key) => serverErrors[key])
            ? 2
            : 3;
        showStep(targetStep, serverErrors);
        setSubmitError(
          typeof payload.error === "string"
            ? payload.error
            : "Lamaran belum berhasil dikirim. Coba lagi sebentar, ya.",
        );
        return;
      }
      setApplicationNumber(payload.application_number);
      setDraft(emptyApplication());
      setCv(null);
      setWebsite("");
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* Storage can be unavailable in private browsing. */
      }
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        document
          .getElementById("application-success")
          ?.focus({ preventScroll: true });
      });
    } catch {
      setSubmitError(
        "Koneksi bermasalah. Periksa internet kamu, lalu coba kirim lagi. Isian kamu masih ada di halaman ini.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (applicationNumber)
    return (
      <ApplicationSuccess
        applicationNumber={applicationNumber}
        jobTitle={job.title}
      />
    );

  return (
    <div className={styles.shell}>
      <header className={styles.formHeader}>
        <div className={styles.headerRow}>
          {step === 1 ? (
            <Link
              prefetch={false}
              href={`/karir/${encodeURIComponent(job.slug)}`}
              className={styles.backIcon}
              aria-label="Kembali ke lowongan"
            >
              <CareerIcon name="back" size={18} />
            </Link>
          ) : (
            <button
              type="button"
              className={styles.backIcon}
              disabled={submitting}
              aria-label={
                step === 2 ? "Kembali ke data diri" : "Kembali ke pengalaman"
              }
              onClick={() => showStep(step - 1)}
            >
              <CareerIcon name="back" size={18} />
            </button>
          )}
          <div className={styles.applying}>
            <span>Melamar sebagai</span>
            <strong>{job.title}</strong>
          </div>
        </div>
        <div
          className={styles.progress}
          aria-label={`Langkah ${step} dari 3: ${stepNames[step - 1]}`}
        >
          <div className={styles.progressLabel}>
            <span>{stepNames[step - 1]}</span>
            <span>Langkah {step} dari 3</span>
          </div>
          <div className={styles.progressBars} aria-hidden="true">
            {[1, 2, 3].map((value) => (
              <span
                key={value}
                className={value <= step ? styles.complete : ""}
              />
            ))}
          </div>
        </div>
      </header>
      <main>
        <form
          id="career-application"
          ref={form}
          className={`${styles.form} ${step === 1 ? styles.firstStep : ""}`}
          noValidate
          onSubmit={submit}
          aria-busy={submitting}
        >
          <fieldset
            disabled={!ready || submitting}
            style={{ display: "contents", border: 0, margin: 0, padding: 0 }}
          >
            <div hidden aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </div>
            {submitError && (
              <div className={styles.errorSummary} role="alert">
                {submitError}
              </div>
            )}
            {step === 1 && (
              <>
                <div className={styles.intro}>
                  <h1 tabIndex={-1}>Kenalan dulu, yuk</h1>
                  <p>Data ini dipakai tim SAMAQU untuk menghubungi kamu.</p>
                </div>
                <TextField
                  name="full_name"
                  label="Nama lengkap"
                  required
                  placeholder="Sesuai KTP"
                  autoComplete="name"
                  value={draft.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  errors={errors}
                />
                <TextField
                  name="whatsapp"
                  label="Nomor WhatsApp"
                  required
                  prefix="+62"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="812 3456 7890"
                  helper="Kabar seleksi dikirim lewat nomor ini"
                  value={draft.whatsapp}
                  onChange={(e) => update("whatsapp", e.target.value)}
                  errors={errors}
                />
                <TextField
                  name="email"
                  label="Email"
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="nama@email.com"
                  value={draft.email}
                  onChange={(e) => update("email", e.target.value)}
                  errors={errors}
                />
                <div className={styles.twoColumns}>
                  <TextField
                    name="birth_date"
                    label="Tanggal lahir"
                    required
                    type="date"
                    autoComplete="bday"
                    value={draft.birth_date}
                    onChange={(e) => update("birth_date", e.target.value)}
                    errors={errors}
                  />
                  <TextField
                    name="city"
                    label="Domisili"
                    required
                    placeholder="Kota"
                    autoComplete="address-level2"
                    value={draft.city}
                    onChange={(e) => update("city", e.target.value)}
                    errors={errors}
                  />
                </div>
                <Choices
                  name="education"
                  label="Pendidikan terakhir"
                  required
                  errors={errors}
                  className={styles.education}
                >
                  <div className={styles.chips}>
                    {EDUCATIONS.map((value) => (
                      <Choice
                        key={value}
                        selected={draft.education === value}
                        onClick={() => update("education", value)}
                      >
                        {value}
                      </Choice>
                    ))}
                  </div>
                </Choices>
              </>
            )}
            {step === 2 && (
              <>
                <div className={styles.intro}>
                  <h1 tabIndex={-1}>Ceritain pengalaman kamu</h1>
                  <p>Belum punya pengalaman? Tetap boleh melamar.</p>
                </div>
                <Choices
                  name="has_admin_experience"
                  label="Pernah kerja sebagai admin?"
                  required
                  errors={errors}
                >
                  <div className={styles.choiceTwo}>
                    <Choice
                      selected={draft.has_admin_experience === true}
                      onClick={() => update("has_admin_experience", true)}
                    >
                      Ya, pernah
                    </Choice>
                    <Choice
                      selected={draft.has_admin_experience === false}
                      onClick={() => update("has_admin_experience", false)}
                    >
                      Belum
                    </Choice>
                  </div>
                </Choices>
                {draft.has_admin_experience === true && (
                  <div className={`${styles.card} ${styles.experience}`}>
                    <strong>Pekerjaan terakhir</strong>
                    <TextField
                      name="last_position"
                      label="Posisi"
                      placeholder="Contoh: Admin Online Shop"
                      value={draft.last_position}
                      onChange={(e) => update("last_position", e.target.value)}
                      errors={errors}
                    />
                    <TextField
                      name="last_company"
                      label="Tempat kerja"
                      placeholder="Nama toko atau perusahaan"
                      value={draft.last_company}
                      onChange={(e) => update("last_company", e.target.value)}
                      errors={errors}
                    />
                    <Choices
                      name="experience_length"
                      label="Lama bekerja"
                      errors={errors}
                    >
                      <div className={styles.choiceThree}>
                        {EXPERIENCE_LENGTHS.map((value) => (
                          <Choice
                            key={value}
                            selected={draft.experience_length === value}
                            onClick={() => update("experience_length", value)}
                          >
                            {experienceLabels[value]}
                          </Choice>
                        ))}
                      </div>
                    </Choices>
                  </div>
                )}
                <Choices
                  name="skills"
                  label="Aplikasi yang kamu kuasai"
                  errors={errors}
                  className={styles.skills}
                  helper="Boleh pilih lebih dari satu"
                >
                  <div className={styles.chips}>
                    {SKILLS.map((value) => (
                      <Choice
                        key={value}
                        selected={draft.skills.includes(value)}
                        onClick={() =>
                          update(
                            "skills",
                            draft.skills.includes(value)
                              ? draft.skills.filter((skill) => skill !== value)
                              : [...draft.skills, value],
                          )
                        }
                      >
                        {draft.skills.includes(value) && (
                          <CareerIcon
                            name="check"
                            size={14}
                            strokeWidth={2.5}
                          />
                        )}
                        {value}
                      </Choice>
                    ))}
                  </div>
                </Choices>
                <TextField
                  name="expected_salary"
                  label="Ekspektasi gaji per bulan"
                  required
                  prefix="Rp"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={
                    draft.expected_salary === ""
                      ? ""
                      : new Intl.NumberFormat("id-ID").format(
                          draft.expected_salary,
                        )
                  }
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "");
                    update("expected_salary", digits ? Number(digits) : "");
                  }}
                  errors={errors}
                />
                <Choices
                  name="start_availability"
                  label="Bisa mulai kerja"
                  required
                  errors={errors}
                >
                  <div className={styles.choiceThree}>
                    {AVAILABILITIES.map((value) => (
                      <Choice
                        key={value}
                        selected={draft.start_availability === value}
                        onClick={() => update("start_availability", value)}
                      >
                        {value}
                      </Choice>
                    ))}
                  </div>
                </Choices>
                <Choices
                  name="source"
                  label="Tahu lowongan ini dari"
                  errors={errors}
                >
                  <div className={styles.chips}>
                    {SOURCES.map((value) => (
                      <Choice
                        key={value}
                        selected={draft.source === value}
                        onClick={() =>
                          update("source", draft.source === value ? "" : value)
                        }
                      >
                        {value}
                      </Choice>
                    ))}
                  </div>
                </Choices>
              </>
            )}
            {step === 3 && (
              <>
                <div className={styles.intro}>
                  <h1 tabIndex={-1}>Satu langkah lagi</h1>
                  <p>Upload CV kamu, cek data, lalu kirim.</p>
                </div>
                <div className={`${styles.field} ${styles.cvField}`}>
                  <span id="cv-label" className={styles.fieldLabel}>
                    CV <Required />
                  </span>
                  {cv ? (
                    <div className={styles.cvCard}>
                      <div className={styles.pdfIcon}>PDF</div>
                      <div className={styles.cvInfo}>
                        <strong title={cv.name}>{cv.name}</strong>
                        <span>
                          <CareerIcon
                            name="check"
                            size={13}
                            strokeWidth={2.5}
                          />
                          Terupload · {Math.max(1, Math.ceil(cv.size / 1024))}{" "}
                          KB
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.smallButton}
                        onClick={() => fileInput.current?.click()}
                        aria-invalid={Boolean(errors.cv)}
                        aria-describedby={
                          errors.cv ? "cv-error cv-helper" : "cv-helper"
                        }
                      >
                        Ganti
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.upload}
                      onClick={() => fileInput.current?.click()}
                      aria-invalid={Boolean(errors.cv)}
                      aria-describedby={
                        errors.cv ? "cv-error cv-helper" : "cv-helper"
                      }
                    >
                      <CareerIcon name="file" size={26} />
                      Pilih file CV
                    </button>
                  )}
                  <input
                    ref={fileInput}
                    id="cv"
                    name="cv"
                    type="file"
                    accept="application/pdf,.pdf"
                    hidden
                    aria-labelledby="cv-label"
                    onChange={selectCv}
                  />
                  <span id="cv-helper" className={styles.helper}>
                    Format PDF, maksimal 2 MB
                  </span>
                  <ErrorText name="cv" errors={errors} />
                </div>
                <TextField
                  name="portfolio_url"
                  label="Link portofolio"
                  optional
                  type="url"
                  placeholder="Google Drive, LinkedIn, dll"
                  value={draft.portfolio_url}
                  onChange={(e) => update("portfolio_url", e.target.value)}
                  errors={errors}
                />
                <div className={styles.field}>
                  <label htmlFor="motivation">
                    Kenapa kamu cocok di posisi ini?{" "}
                    <span className={styles.optional}>(opsional)</span>
                  </label>
                  <textarea
                    id="motivation"
                    name="motivation"
                    rows={3}
                    placeholder="Cukup 2–3 kalimat"
                    className={styles.textarea}
                    value={draft.motivation}
                    onChange={(e) => update("motivation", e.target.value)}
                    aria-invalid={Boolean(errors.motivation)}
                    aria-describedby={
                      errors.motivation ? "motivation-error" : undefined
                    }
                  />
                  <ErrorText name="motivation" errors={errors} />
                </div>
                <section className={`${styles.card} ${styles.review}`}>
                  <div className={styles.reviewHeader}>
                    <h2>Cek lagi data kamu</h2>
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() => showStep(1)}
                    >
                      Ubah
                    </button>
                  </div>
                  <dl>
                    <div>
                      <dt>Nama</dt>
                      <dd>{draft.full_name}</dd>
                    </div>
                    <div>
                      <dt>WhatsApp</dt>
                      <dd>{`+${normalizeWhatsapp(draft.whatsapp)}`}</dd>
                    </div>
                    <div>
                      <dt>Pengalaman admin</dt>
                      <dd>
                        {draft.has_admin_experience
                          ? `Ya${draft.experience_length ? `, ${experienceLabels[draft.experience_length]}` : ""}`
                          : "Belum"}
                      </dd>
                    </div>
                    <div>
                      <dt>Mulai kerja</dt>
                      <dd>{draft.start_availability}</dd>
                    </div>
                  </dl>
                </section>
                <div>
                  <label htmlFor="consent" className={styles.consent}>
                    <input
                      id="consent"
                      name="consent"
                      type="checkbox"
                      required
                      checked={draft.consent}
                      onChange={(e) => update("consent", e.target.checked)}
                      aria-invalid={Boolean(errors.consent)}
                      aria-describedby={
                        errors.consent ? "consent-error" : undefined
                      }
                    />
                    <span>
                      Saya setuju data dan CV ini diproses SAMAQU khusus untuk
                      keperluan rekrutmen, dan menyatakan data yang saya isi
                      benar.
                    </span>
                  </label>
                  <ErrorText name="consent" errors={errors} />
                </div>
              </>
            )}
          </fieldset>
        </form>
      </main>
      <div
        className={`${styles.actionBar} ${step > 1 ? styles.actionsSplit : ""}`}
      >
        {step > 1 && (
          <button
            type="button"
            className={styles.secondary}
            disabled={submitting}
            onClick={() => showStep(step - 1)}
          >
            Kembali
          </button>
        )}
        <button
          type="submit"
          form="career-application"
          className={styles.primary}
          disabled={
            !ready || submitting || (step === 3 && (!cv || !draft.consent))
          }
        >
          {submitting ? (
            "Mengirim lamaran…"
          ) : step === 3 ? (
            <>
              Kirim Lamaran
              <CareerIcon name="send" size={17} />
            </>
          ) : (
            "Lanjut"
          )}
        </button>
        {step === 1 && (
          <span>
            {storageAvailable
              ? "Isian tersimpan otomatis di HP kamu"
              : "Penyimpanan tidak tersedia. Jangan tutup halaman ini."}
          </span>
        )}
      </div>
    </div>
  );
}
