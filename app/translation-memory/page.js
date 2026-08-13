export default function TranslationMemoryPage() {
  return (
    <div>
      <div className="page-head">
        <div className="page-eyebrow">Translation Memory</div>
        <h1 className="page-title">Translation memory</h1>
        <p className="page-sub">A persistent glossary of preferred terms, character names, and forbidden translations.</p>
      </div>
      <div className="empty-state">
        <h3>Coming after the MVP</h3>
        <p>
          The reviewer doesn't use a glossary yet — it judges each line on meaning, tone, and
          naturalness alone. Persistent terminology memory is planned for phase 2.
        </p>
      </div>
    </div>
  );
}
