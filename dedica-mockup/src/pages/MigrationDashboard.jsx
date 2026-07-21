import { Badge, Button, Card, EmptyState } from "../components/index.js";

const nextMilestones = [
  "Scegli una candela dal catalogo",
  "Personalizza dedica, stile e confezione",
  "Ricevi la bozza digitale prima della produzione"
];

export function MigrationDashboard({ onOpenHome, onOpenAccount }) {
  return (
    <main className="migration-shell">
      <section className="migration-card">
        <Badge>DÈDICA</Badge>
        <h1>Candele personalizzate, pronte da dedicare.</h1>
        <p>
          Entra nello shop, scegli l’occasione e crea una candela con dedica,
          bozza digitale e confezione curata.
        </p>
        <div className="migration-actions">
          <Button onClick={onOpenHome}>Vai allo shop</Button>
          <Button onClick={onOpenAccount} variant="secondary">Area cliente</Button>
        </div>
      </section>

      <Card className="migration-card muted-card">
        <h2>Come funziona</h2>
        <ul>
          {nextMilestones.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>

      <EmptyState
        title="Ogni candela nasce per qualcuno"
        description="Prepariamo ogni dettaglio dopo l’ordine, così il regalo resta personale e curato."
      />
    </main>
  );
}
