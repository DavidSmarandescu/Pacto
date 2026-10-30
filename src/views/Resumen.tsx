import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { capTable, controlStatus } from '../engine';
import { ROLE_LABEL } from '../lib/colors';
import { eur, eurPrecise, num, pct } from '../lib/format';
import { Badge, Card, Dot, SplitBar, Stat } from '../components/ui';
import { axisProps, tooltipProps } from './chart';
import type { ViewProps } from './types';

export default function Resumen({ s, res, colors }: ViewProps) {
  const [at, setAt] = useState<string>('final');
  const snap = at === 'final' ? res.final : res.snapshots.find((x) => x.eventId === at) ?? res.final;
  const rows = capTable(snap, s.holders, s.governance);
  const ctrl = controlStatus(snap, s.holders, s.governance);
  const name = (id: string) => s.holders.find((h) => h.id === id)?.name ?? id;
  const role = (id: string) => s.holders.find((h) => h.id === id)?.role;

  const dilution = useMemo(() => res.snapshots.filter((sn) => s.events.find((e) => e.id === sn.eventId)?.type !== 'nota').map((sn) => {
    const r = capTable(sn, s.holders, s.governance);
    const point: Record<string, number | string> = { name: sn.label };
    for (const row of r) point[row.holderId] = +(row.econPct * 100).toFixed(2);
    return point;
  }), [res, s]);

  const ids = s.holders.map((h) => h.id).filter((id) => dilution.some((p) => p[id] !== undefined));
  const total = rows.reduce((a, r) => a + r.shares, 0);
  const classNames = (byClass: Record<string, number>) =>
    Object.entries(byClass).map(([c, n]) => `${num(n)} ${snap.classes[c]?.name.toLowerCase() ?? c}`).join(' · ');

  return (
    <div className="stack">
      <div className="stats">
        <Stat label="Valoración post-money" value={snap.postMoney ? eur(snap.postMoney) : '—'} hint={snap.pricePerShare ? `${eurPrecise(snap.pricePerShare)} / participación` : 'Sin ronda con precio aún'} />
        <Stat label="Participaciones (totalmente diluido)" value={num(total)} hint={`${rows.length} titulares`} />
        <Stat label="Fundadores · % económico" value={pct(ctrl.blocEconPct)} hint={s.governance.sindicacion ? 'Bloque sindicado' : 'Mayor fundador (sin sindicación)'} />
        <Stat label="Fundadores · % de voto" value={pct(ctrl.blocVotePct)} tone={ctrl.ordinaria ? 'ok' : 'bad'} hint={<span className="badges"><Badge ok={ctrl.ordinaria}>&gt;50 %</Badge><Badge ok={ctrl.reforzada}>≥2/3</Badge></span>} />
      </div>

      <Card
        title="Cap table"
        subtitle="% económico sobre el total diluido (incluye el pool) frente a % de voto (el pool y las participaciones sin voto no votan)."
        actions={
          <select aria-label="Momento" value={at} onChange={(e) => setAt(e.target.value)}>
            <option value="final">Situación actual</option>
            {res.snapshots.map((sn) => <option key={sn.eventId} value={sn.eventId}>Tras: {sn.label}</option>)}
          </select>
        }
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Socio</th><th className="num">Participaciones</th><th className="num">% económico</th><th className="num">% voto</th><th className="hide-sm">Detalle</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.holderId}>
                  <td>
                    <div className="who"><Dot color={colors[r.holderId]} /><div><strong>{name(r.holderId)}</strong><span className="muted small">{ROLE_LABEL[role(r.holderId) ?? 'inversor']}</span></div></div>
                  </td>
                  <td className="num">{num(r.shares)}</td>
                  <td className="num">{pct(r.econPct)}</td>
                  <td className="num"><span className={r.votePct > r.econPct + 0.0005 ? 'up' : r.votePct + 0.0005 < r.econPct ? 'down' : ''}>{pct(r.votePct)}</span></td>
                  <td className="hide-sm"><SplitBar econ={r.econPct} vote={r.votePct} color={colors[r.holderId]} /><span className="muted tiny">{classNames(r.byClass)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Dilución por operación" subtitle="% económico de cada socio tras cada ronda o venta.">
        <div className="chart">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={dilution} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(148,180,255,.1)" />
              <XAxis dataKey="name" {...axisProps} interval={0} tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
              <YAxis {...axisProps} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip {...tooltipProps} formatter={(v: number, k: string) => [`${v.toLocaleString('es-ES')} %`, name(k)]} />
              <Legend formatter={(k: string) => <span className="legend-item">{name(k)}</span>} />
              {ids.map((id) => <Bar key={id} dataKey={id} stackId="a" fill={colors[id]} maxBarSize={64} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
