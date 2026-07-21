export function CategoryPicker({ categories = [], value, onChange }) {
  return (
    <div className="ui-picker-grid">
      {categories.map(category => (
        <button
          key={category.id}
          type="button"
          className={`ui-picker-card ${category.id === value ? "active" : ""}`}
          onClick={() => onChange(category.id)}
        >
          <strong>{category.name}</strong>
          <span>{category.description || `${category.subcategories?.length || 0} sottocategorie`}</span>
          <small>{category.subcategories?.length || 0} sottocategorie</small>
        </button>
      ))}
    </div>
  );
}

export function SubcategoryPicker({ subcategories = [], value, onChange }) {
  return (
    <div className="ui-chip-grid">
      {subcategories.map(subcategory => (
        <button
          key={subcategory}
          type="button"
          className={`ui-chip ${subcategory === value ? "active" : ""}`}
          onClick={() => onChange(subcategory)}
        >
          {subcategory}
        </button>
      ))}
    </div>
  );
}
