import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { capTable, vestedAt } from '../engine';
import { num, pct } from '../lib/format';
import { Card, Dot, NumInput } from '../components/ui';
import { axisProps, tooltipProps } from './chart';
import type { ViewProps } from './types';

function monthsSince(start: string, now = new Date()) {
  const d = new Date(`${start}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth() - (now.getDate() < d.getDate() ? 1 : 0));
}

export default function Vesting({ s, res, mutate, colors }: ViewProps) {
  const founders = s.holders.filter((h) => h.role === 'fundador' || h.role === 'empleado');
  const rows = capTable(res.final, s.holders, s.governance);
  const shares = (id: string) => rows.find((r) => r.holderId === id)?.shares ?? 0;
  const plan = (id: string) => s.vesting.find((v) => v.holderId === id);
  const plans = founders.map((f) => ({ f, p: plan(f.id) })).filter((x) => x.p);

  const earliest = plans.map((x) => x.p!.start).sort()[0];
  // Desfase en meses de cada plan respecto al que empezó antes, para dibujarlos en el mismo eje.
  const offset = (start: string) => (earliest ? monthsSince(earliest) - monthsSince(start) : 0);
  const horizon = Math.max(48, ...plans.map((x) => offset(x.p!.start) + x.p!.months));
  const data = Array.from({ length: horizon + 1 }, (_, m) => {
    const pt: Record<string, number> = { m };
    for (const { f, p } of plans) {
      const local = m - offset(p!.start);
      pt[f.id] = local < 0 ? 0 : vestedAt(1000, p!.months, p!.cliffMonths, local) / 10;
    }
    return pt;
  });
  const nowM = earliest ? monthsSince(earliest) : 0;

  const upsert = (id: string, patch: Partial<{ months: number; cliffMonths: number; start: string }>) => mutate((d) => {
    const v = d.vesting.find((x) => x.holderId === id);
    if (v) Object.assign(v, patch);
    else d.vesting.push({ holderId: id, months: 48, cliffMonths: 12, start: new Date().toISOString().slice(0, 10), ...patch });
  });

  return (
    <div className="stack">
      <Card title="Vesting de fundadores" subtitle="Consolidación de participaciones con cliff. Lo no consolidado se recompra si un fundador sale antes (cláusulas de good / bad leaver del pacto de socios).">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Socio</th><th>Inicio</th><th className="num">Meses</th><th className="num">Cliff</th><th className="num">Consolidado hoy</th><th></th></tr></thead>
            <tbody>
              {founders.map((f) => {
                const p = plan(f.id);
                const total = shares(f.id);
                const vested = p ? vestedAt(total, p.months, p.cliffMonths, monthsSince(p.start)) : total;
                return (
                  <tr key={f.id}>
                    <td><div className="who"><Dot color={colors[f.id]} /><strong>{f.name}</strong></div></td>
                    {p ? (
                      <>
                        <td><input type="date" value={p.start} onChange={(e) => upsert(f.id, { start: e.target.value })} /></td>
                        <td className="num"><NumInput value={p.months} onChange={(v) => upsert(f.id, { months: Math.round(v) })} /></td>
                        <td className="num"><NumInput value={p.cliffMonths} onChange={(v) => upsert(f.id, { cliffMonths: Math.round(v) })} /></td>
                        <td className="num"><strong>{num(vested)}</strong> <span className="muted small">/ {num(total)} · {total ? pct(vested / total, 0) : '—'}</span></td>
                        <td><button className="icon" aria-label="Quitar vesting" onClick={() => mutate((d) => { d.vesting = d.vesting.filter((v) => v.holderId !== f.id); })}>×</button></td>
                      </>
                    ) : (
                      <td colSpan={5}><button className="link" onClick={() => upsert(f.id, {})}>+ Añadir calendario de vesting (48 meses, cliff 12)</button></td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {plans.length > 0 && (
        <Card title="Calendario de consolidación" subtitle="% consolidado de cada fundador mes a mes. La línea marca hoy.">
          <div className="chart">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,180,255,.1)" />
                <XAxis dataKey="m" {...axisProps} tickFormatter={(m) => `m${m}`} interval={11} />
                <YAxis {...axisProps} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip {...tooltipProps} labelFormatter={(m) => `Mes ${m}`} formatter={(v: number, k: string) => [`${v} %`, s.holders.find((h) => h.id === k)?.name ?? k]} />
                <Legend formatter={(k: string) => <span className="legend-item">{s.holders.find((h) => h.id === k)?.name}</span>} />
                {nowM <= horizon && <ReferenceLine x={nowM} stroke="#5FE3FF" strokeDasharray="4 4" label={{ value: 'Hoy', fill: '#5FE3FF', fontSize: 12, position: 'insideTopRight' }} />}
                {plans.map(({ f }) => <Line key={f.id} type="stepAfter" dataKey={f.id} stroke={colors[f.id]} dot={false} strokeWidth={2} isAnimationActive={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
