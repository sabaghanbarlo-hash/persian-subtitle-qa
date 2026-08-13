export default function SettingsPage() {
  return (
    <div>
      <div className="page-head">
        <div className="page-eyebrow">Settings</div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Style preferences, prompt templates, and review cost controls.</p>
      </div>
      <div className="empty-state">
        <h3>Coming after the MVP</h3>
        <p>
          Personal style memory (conversational vs. formal Persian), editable prompt templates,
          and per-category issue toggles are planned for a later phase.
        </p>
      </div>
    </div>
  );
}
