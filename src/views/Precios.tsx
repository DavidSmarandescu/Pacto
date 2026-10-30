const PLANS = [
  {
    name: 'Gratis',
    price: '0 €',
    period: 'para siempre',
    cta: 'Empezar',
    features: ['1 empresa y 1 escenario', 'Cap table, rondas y notas convertibles', 'Waterfall de salida básico', 'Datos solo en tu navegador'],
  },
  {
    name: 'Founder',
    price: '12 €',
    period: 'al mes · 99 € al año',
    cta: 'Probar 14 días',
    featured: true,
    features: ['Escenarios ilimitados para comparar rondas', 'Simulador de control y ventas secundarias', 'Voto plural, sin voto y sindicación', 'Exportación PDF y JSON para tu abogado', 'Vesting y materias reservadas'],
  },
  {
    name: 'Aceleradoras y despachos',
    price: 'Desde 149 €',
    period: 'al mes',
    cta: 'Hablar con ventas',
    features: ['Hasta 25 startups en cartera', 'Marca blanca con vuestro logo', 'Plantillas de pacto de socios', 'Sesiones de formación para fundadores'],
  },
];

export default function Precios() {
  return (
    <div className="stack">
      <div className="pricing">
        {PLANS.map((p) => (
          <article key={p.name} className={`plan ${p.featured ? 'plan-featured' : ''}`}>
            {p.featured && <span className="plan-flag">Más elegido</span>}
            <h3>{p.name}</h3>
            <p className="plan-price"><strong>{p.price}</strong> <span className="muted small">{p.period}</span></p>
            <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
            <button className={`btn ${p.featured ? 'btn-primary' : 'btn-ghost'}`} onClick={() => alert('Demo de portfolio: los pagos no están activos.')}>{p.cta}</button>
          </article>
        ))}
      </div>

      <section className="card">
        <header className="card-head"><div><h3>Modelo de negocio</h3><p className="muted small">Por qué alguien pagaría por Pacto.</p></div></header>
        <div className="biz">
          <div>
            <h4>Problema</h4>
            <p>Los fundadores negocian rondas y ventas secundarias con hojas de cálculo frágiles. Casi nadie modela el voto por separado de lo económico, y se enteran de que han perdido el control cuando ya han firmado.</p>
          </div>
          <div>
            <h4>Clientes</h4>
            <p><strong>Fundadores</strong> antes de una ronda (pago puntual de 2–3 meses). <strong>Aceleradoras, business angels y despachos</strong> que acompañan a muchas startups a la vez (ingreso recurrente B2B).</p>
          </div>
          <div>
            <h4>Ventaja</h4>
            <p>Hecho para la SL española: participaciones sin voto, voto plural y mayorías de la LSC. Las herramientas internacionales de cap table no modelan bien las particularidades de la SL y cuestan bastante más.</p>
          </div>
          <div>
            <h4>Crecimiento</h4>
            <p>Versión gratuita como gancho en comunidades de founders; acuerdos con aceleradoras que regalan el plan Founder a sus startups; contenido SEO sobre «cómo vender participaciones sin perder el control».</p>
          </div>
        </div>
      </section>
    </div>
  );
}
