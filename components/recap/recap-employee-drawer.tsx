"use client";

import { AttendanceStatusTag } from "@/components/attendance/attendance-status-tag";
import { employeeStatusTone } from "@/components/employees/status-tone";
import { Icon } from "@/components/icons";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { InfoGrid, InfoItem } from "@/components/ui/detail-info";
import { FormSection } from "@/components/ui/form-section";
import { ini } from "@/lib/data";
import {
  formatClockID,
  formatDateID,
  formatWeekdayDateID,
} from "@/lib/datetime";
import { formatDurationMinutes } from "@/lib/attendance/rules";
import type { RecapPeriod, RecapRow } from "@/lib/recap/types";

export function RecapEmployeeDrawer({
  row,
  period,
  onClose,
}: {
  row: RecapRow | null;
  period: RecapPeriod;
  onClose: () => void;
}) {
  const employee = row?.employee ?? null;
  const activeNote = employee
    ? employee.status === "Nonaktif"
      ? employee.activeEndDate
        ? `Masa aktif sampai ${formatDateID(employee.activeEndDate)}`
        : "Tanggal Nonaktif tidak tercatat. Alfa di luar masa aktif tidak dihitung."
      : `Bergabung ${formatDateID(employee.joinedAt)}`
    : "";

  return (
    <DetailDrawer
      open={Boolean(row)}
      title="Detail Rekap Karyawan"
      description={`Periode ${formatDateID(period.from)} – ${formatDateID(period.to)}`}
      size="md"
      onClose={onClose}
    >
      {row && employee && (
        <div className="flex flex-col gap-4">
          <FormSection
            icon="users"
            title="Karyawan"
            description="Identitas dan masa aktif pada periode ini."
          >
            <div className="flex items-center gap-4">
              <div
                className="av"
                style={{ width: 56, height: 56, fontSize: 18 }}
              >
                {ini(employee.fullName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[17px] leading-tight break-words">
                  {employee.fullName}
                </div>
                <div className="sub text-[12px]">
                  {employee.id} · {employee.position}
                </div>
                <div className="sub text-[11px]">
                  {employee.department} · {activeNote}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`tag ${employeeStatusTone(employee.status)}`}>
                    {employee.status}
                  </span>
                  <span className="tag t-info">
                    Kehadiran {row.attendancePercent}%
                  </span>
                </div>
              </div>
            </div>
            {employee.status === "Nonaktif" && !employee.inactiveDateKnown && (
              <div
                className="mt-3 p-3 rounded-xl text-[12px]"
                style={{ background: "#FFF7E6", color: "#8A5A12" }}
              >
                Tanggal berhenti tidak ditemukan di riwayat status. Rekap hanya
                menghitung hari yang masih bisa dipastikan aktif; alfa di luar
                masa aktif tidak dihitung.
              </div>
            )}
          </FormSection>

          <FormSection
            icon="clock"
            title="Ringkasan Periode"
            description="Angka dihitung ulang dari kehadiran dan cuti yang disetujui."
          >
            <InfoGrid>
              <InfoItem label="Hari kerja" value={`${row.workdays} hari`} />
              <InfoItem label="Hadir" value={`${row.present} hari`} />
              <InfoItem
                label="Terlambat"
                value={`${row.lateCount}× · ${row.lateMinutes} mnt`}
              />
              <InfoItem
                label="Pulang cepat"
                value={`${row.earlyCount}× · ${row.earlyMinutes} mnt`}
              />
              <InfoItem
                label="Lupa check-out"
                value={`${row.missingCheckout} hari`}
              />
              <InfoItem label="Alfa" value={`${row.alfa} hari`} />
              <InfoItem label="Cuti" value={`${row.cuti} hari`} />
              <InfoItem label="Sakit" value={`${row.sakit} hari`} />
              <InfoItem label="Izin" value={`${row.izin} hari`} />
              <InfoItem
                label="Total jam kerja"
                value={formatDurationMinutes(row.workMinutes)}
                full
              />
            </InfoGrid>
            {row.problemDays > 0 && (
              <div
                className="mt-3 p-3 rounded-xl text-[12px]"
                style={{ background: "#FDF0F0", color: "var(--bad)" }}
              >
                {row.problemDays} hari perlu ditinjau (Alfa/Lupa Check-out)
                sebelum rekap dipakai untuk payroll.
              </div>
            )}
          </FormSection>

          <FormSection
            icon="cal"
            title="Rincian Harian"
            description="Hari bermasalah bisa langsung dikoreksi di Kehadiran Harian."
          >
            {row.days.length === 0 ? (
              <div className="text-[12px] sub">
                Tidak ada rentang hari yang bisa dihitung pada periode ini.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {row.days.map((day) => {
                  const problem =
                    day.status === "Alfa" || day.status === "Lupa Check-out";
                  return (
                    <div
                      key={day.date}
                      className="p-3 rounded-xl border"
                      style={{
                        borderColor: problem ? "#F3CACA" : "var(--line)",
                        background: problem ? "#FFF9F9" : "#fff",
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold">
                            {formatWeekdayDateID(day.date)}
                          </div>
                          <div className="text-[11px] sub">
                            Masuk:{" "}
                            {day.record?.checkInAt
                              ? formatClockID(day.record.checkInAt)
                              : "—"}{" "}
                            · Pulang:{" "}
                            {day.record?.checkOutAt
                              ? formatClockID(day.record.checkOutAt)
                              : "—"}{" "}
                            · {formatDurationMinutes(day.durationMinutes)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <AttendanceStatusTag day={day} />
                          {problem && (
                            <a
                              className="btn btn-g !py-1 !px-2 !text-[11px]"
                              href={`/attendance/harian?date=${day.date}`}
                            >
                              <Icon
                                name="clock"
                                style={{ width: 12, height: 12 }}
                              />
                              Koreksi
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </FormSection>
        </div>
      )}
    </DetailDrawer>
  );
}
