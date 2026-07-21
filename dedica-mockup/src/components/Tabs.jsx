export function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="ui-tabs" role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === activeTab ? "active" : ""}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
