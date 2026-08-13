export default function ProjectsPage() {
  return (
    <div>
      <div className="page-head">
        <div className="page-eyebrow">Projects</div>
        <h1 className="page-title">Projects</h1>
        <p className="page-sub">Group episodes by anime, keep per-project glossaries, and track review history.</p>
      </div>
      <div className="empty-state">
        <h3>Coming after the MVP</h3>
        <p>
          Right now each review is a one-off session. Persistent projects and episode history are
          planned for the next phase, once the core review workflow is solid.
        </p>
      </div>
    </div>
  );
}
