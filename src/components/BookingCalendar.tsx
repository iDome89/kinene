import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  addDays,
  civilFromDay,
  daysInMonth,
  dayFromCivil,
  formatDay,
  formatDayIt,
  monthNameIt,
  parseDay,
  startOfMonth,
  weekdayOf,
} from '@/lib/dates';
import { billableUnits, departureDayFor } from '@/lib/availability';
import { services, type ServiceId } from '@/config/business';
import { formatEuro } from '@/lib/pricing';

type Status = 0 | 1 | 2;

interface DayInfo {
  readonly d: string;
  readonly s: Status;
  readonly left: number;
  readonly hs: 0 | 1;
}

interface Props {
  readonly service: ServiceId;
  readonly months?: number;
  readonly initialStart?: string;
  readonly initialEnd?: string;
}

const WEEKDAY_LABELS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

const STATUS_LABEL: Record<Status, string> = {
  0: 'disponibile',
  1: 'al completo',
  2: 'chiuso',
};

export default function BookingCalendar({
  service: initialService,
  months = 3,
  initialStart,
  initialEnd,
}: Props) {
  const restoredStart = initialStart ? parseDay(initialStart) : null;
  const restoredEnd = initialEnd ? parseDay(initialEnd) : null;

  const [service, setService] = useState<ServiceId>(initialService);
  const [byDay, setByDay] = useState<Map<number, DayInfo>>(new Map());
  const [today, setToday] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(
    restoredStart === null ? null : startOfMonth(restoredStart),
  );
  const [start, setStart] = useState<number | null>(restoredStart);
  const [end, setEnd] = useState<number | null>(
    restoredEnd !== null && restoredStart !== null && restoredEnd > restoredStart ? restoredEnd : null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  const definition = services[service];
  const picksRange = service === 'pensione' || service === 'asilo-diurno';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/availability.json?days=${months * 31 + 31}`)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((payload: { today: string; days: DayInfo[] }) => {
        if (cancelled) return;
        const map = new Map<number, DayInfo>();
        for (const day of payload.days) {
          const number = parseDay(day.d);
          if (number !== null) map.set(number, day);
        }
        const todayDay = parseDay(payload.today);
        setByDay(map);
        setToday(todayDay);
        setCursor((current) => current ?? (todayDay === null ? null : startOfMonth(todayDay)));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Non riusciamo a caricare il calendario. Usa i campi data qui sotto o scrivici su WhatsApp.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [months]);

  const resolvedEnd = useMemo(() => {
    if (start === null) return null;
    return departureDayFor(service, start, end ?? start);
  }, [service, start, end]);

  const units = useMemo(() => {
    if (start === null || resolvedEnd === null) return 0;
    return Math.max(0, billableUnits(service, start, resolvedEnd));
  }, [service, start, resolvedEnd]);

  const totalCents = units * definition.priceCents;

  const conflict = useMemo(() => {
    if (start === null || resolvedEnd === null) return null;
    for (let day = start; day <= resolvedEnd; day += 1) {
      const info = byDay.get(day);
      if (!info || info.s !== 0) return day;
    }
    return null;
  }, [byDay, start, resolvedEnd]);

  const overLimit = definition.maxNights !== null && units > definition.maxNights;

  useEffect(() => {
    if (!liveRef.current) return;
    if (start === null) {
      liveRef.current.textContent = 'Nessuna data selezionata.';
    } else if (resolvedEnd === null || start === resolvedEnd) {
      liveRef.current.textContent = `Selezionato ${formatDayIt(start)}.`;
    } else {
      liveRef.current.textContent = `Dal ${formatDayIt(start)} al ${formatDayIt(resolvedEnd)}, ${units} ${
        units === 1 ? definition.priceUnit : `${definition.priceUnit}i`
      }.`;
    }
  }, [start, resolvedEnd, units, definition.priceUnit]);

  function selectDay(day: number) {
    const info = byDay.get(day);
    if (!info || info.s !== 0) return;

    if (!picksRange) {
      setStart(day);
      setEnd(null);
      return;
    }

    if (start === null || end !== null || day < start) {
      setStart(day);
      setEnd(null);
      return;
    }

    setEnd(day);
  }

  function shiftMonth(delta: number) {
    setCursor((current) => {
      if (current === null) return current;
      const { year, month } = civilFromDay(current);
      const target = month - 1 + delta;
      return dayFromCivil(year + Math.floor(target / 12), ((target % 12) + 12) % 12 + 1, 1);
    });
  }

  if (loading) {
    return (
      <div class="rounded-[var(--radius-card)] border border-edge bg-surface-raised p-6">
        <div class="h-6 w-40 animate-pulse rounded bg-surface-tint" />
        <div class="mt-6 grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }, (_, index) => (
            <div key={index} class="aspect-square animate-pulse rounded-lg bg-surface-tint" />
          ))}
        </div>
      </div>
    );
  }

  if (error || cursor === null || today === null) {
    return (
      <div class="rounded-[var(--radius-card)] border border-danger/35 bg-danger-surface p-6 text-sm text-danger">
        {error ?? 'Calendario non disponibile.'}
      </div>
    );
  }

  const monthsToRender = Array.from({ length: months }, (_, index) => {
    const { year, month } = civilFromDay(cursor);
    const target = month - 1 + index;
    return dayFromCivil(year + Math.floor(target / 12), ((target % 12) + 12) % 12 + 1, 1);
  });

  return (
    <div>
      <fieldset class="m-0 border-0 p-0">
        <legend class="text-sm font-semibold">Servizio</legend>
        <div class="mt-3 flex flex-wrap gap-2">
          {Object.values(services).map((option) => (
            <label
              key={option.id}
              class={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm transition-colors ${
                service === option.id
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-edge-strong bg-surface-raised hover:bg-surface-tint'
              }`}
            >
              <input
                type="radio"
                name="service"
                value={option.id}
                checked={service === option.id}
                onChange={() => {
                  setService(option.id);
                  setStart(null);
                  setEnd(null);
                }}
                class="sr-only"
              />
              {option.name}
            </label>
          ))}
        </div>
      </fieldset>

      <p class="mt-4 text-sm text-muted">
        {picksRange
          ? 'Tocca il giorno di consegna, poi quello di ritiro.'
          : 'Tocca la sera di consegna: il ritiro è il mattino successivo.'}
      </p>

      <div class="mt-5 rounded-[var(--radius-card)] border border-edge bg-surface-raised p-4 sm:p-6">
        <div class="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            disabled={cursor <= startOfMonth(today)}
            class="flex h-11 w-11 items-center justify-center rounded-full border border-edge-strong transition-colors hover:bg-surface-tint disabled:opacity-40"
            aria-label="Mese precedente"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <p class="m-0 font-display text-lg font-semibold">
            {monthsToRender.length > 1
              ? `${monthNameIt(civilFromDay(monthsToRender[0]!).month)} — ${monthNameIt(
                  civilFromDay(monthsToRender[monthsToRender.length - 1]!).month,
                )} ${civilFromDay(monthsToRender[monthsToRender.length - 1]!).year}`
              : `${monthNameIt(civilFromDay(cursor).month)} ${civilFromDay(cursor).year}`}
          </p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            class="flex h-11 w-11 items-center justify-center rounded-full border border-edge-strong transition-colors hover:bg-surface-tint"
            aria-label="Mese successivo"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        <div class="mt-6 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {monthsToRender.map((monthStart) => {
            const { year, month } = civilFromDay(monthStart);
            const leading = (weekdayOf(monthStart) + 6) % 7;
            const total = daysInMonth(year, month);

            return (
              <div key={monthStart}>
                <p class="m-0 mb-3 text-center font-sans text-sm font-semibold capitalize">
                  {monthNameIt(month)} {year}
                </p>
                <div class="grid grid-cols-7 gap-1">
                  {WEEKDAY_LABELS.map((label) => (
                    <abbr
                      key={label}
                      title={label}
                      class="pb-1 text-center text-[0.65rem] font-medium uppercase tracking-wide text-muted no-underline"
                    >
                      {label.slice(0, 2)}
                    </abbr>
                  ))}
                </div>
                <div class="mt-1 grid grid-cols-7 gap-1">
                  {Array.from({ length: leading }, (_, index) => (
                    <span key={`pad-${index}`} aria-hidden="true" />
                  ))}
                  {Array.from({ length: total }, (_, index) => {
                    const day = addDays(monthStart, index);
                    const info = byDay.get(day);
                    const status: Status = info?.s ?? 2;
                    const past = day < today;
                    const selectable = !past && status === 0;

                    const inRange =
                      start !== null && resolvedEnd !== null && day >= start && day <= resolvedEnd;
                    const isEdge = day === start || day === resolvedEnd;

                    return (
                      <button
                        key={day}
                        type="button"
                        data-day={formatDay(day)}
                        disabled={!selectable}
                        onClick={() => selectDay(day)}
                        aria-pressed={inRange}
                        aria-label={`${formatDayIt(day)} — ${
                          past ? 'data passata' : STATUS_LABEL[status]
                        }${info && status === 0 ? `, ${info.left} posti liberi` : ''}`}
                        class={[
                          'relative flex aspect-square min-h-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors',
                          isEdge
                            ? 'bg-primary font-semibold text-on-primary'
                            : inRange
                              ? 'bg-surface-tint font-medium text-body'
                              : selectable
                                ? 'text-body hover:bg-surface-tint'
                                : 'cursor-not-allowed text-muted opacity-40',
                          !selectable && !past && status === 1 ? 'line-through' : '',
                        ].join(' ')}
                      >
                        {index + 1}
                        {info?.hs === 1 && !isEdge && (
                          <span
                            class="absolute bottom-1 h-1 w-1 rounded-full bg-accent"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <ul class="m-0 mt-6 flex list-none flex-wrap gap-x-5 gap-y-2 border-t border-edge p-0 pt-5 text-xs text-muted">
          <li class="flex items-center gap-2">
            <span class="h-3 w-3 rounded bg-primary" aria-hidden="true" /> Selezionato
          </li>
          <li class="flex items-center gap-2">
            <span class="h-3 w-3 rounded border border-edge-strong" aria-hidden="true" /> Disponibile
          </li>
          <li class="flex items-center gap-2">
            <span class="h-3 w-3 rounded bg-surface-tint opacity-50" aria-hidden="true" /> Non disponibile
          </li>
          <li class="flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" /> Alta stagione
          </li>
        </ul>
      </div>

      <p ref={liveRef} class="sr-only" aria-live="polite" />

      <input type="hidden" name="service" value={service} />
      <input type="hidden" name="startDate" value={start === null ? '' : formatDay(start)} />
      <input type="hidden" name="endDate" value={resolvedEnd === null ? '' : formatDay(resolvedEnd)} />

      <div class="mt-6 rounded-[var(--radius-card)] border border-edge bg-surface-tint p-6">
        {start === null ? (
          <p class="m-0 text-sm text-muted">Seleziona le date per vedere il preventivo.</p>
        ) : (
          <>
            <dl class="m-0 flex flex-col gap-2 text-sm">
              <div class="flex items-center justify-between gap-4">
                <dt class="text-muted">Consegna</dt>
                <dd class="m-0 font-medium">
                  {formatDayIt(start)} · {definition.checkInFrom}—{definition.checkInTo}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-4">
                <dt class="text-muted">Ritiro</dt>
                <dd class="m-0 font-medium">
                  {resolvedEnd === null ? '—' : formatDayIt(resolvedEnd)} · {definition.checkOutFrom}—
                  {definition.checkOutTo}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-4 border-t border-edge pt-3">
                <dt class="text-muted">
                  {units} × {formatEuro(definition.priceCents)} / {definition.priceUnit}
                </dt>
                <dd class="m-0 font-display text-xl font-semibold tabular-nums">{formatEuro(totalCents)}</dd>
              </div>
            </dl>

            {overLimit && (
              <p class="m-0 mt-4 text-sm font-medium text-danger">
                {definition.name}: il soggiorno non può superare {definition.maxNights}{' '}
                {definition.maxNights === 1 ? 'notte' : 'notti'}. Accorcia le date.
              </p>
            )}

            {conflict !== null && (
              <p class="m-0 mt-4 text-sm font-medium text-danger">
                Il {formatDayIt(conflict)} non è disponibile. Scegli un altro intervallo.
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setStart(null);
                setEnd(null);
              }}
              class="mt-4 min-h-11 text-sm font-medium text-accent underline underline-offset-4"
            >
              Azzera le date
            </button>
          </>
        )}
      </div>
    </div>
  );
}
