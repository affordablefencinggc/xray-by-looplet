export function WalkFloorRail({ floors, selected, onSelect }: {
  floors: { id: string; label: string; elevation: number }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return <nav className="walk-floor-rail" aria-label="Starting floor">
    <h3>Choose a floor</h3>
    {floors.map((floor, index) => <button type="button" key={floor.id}
      aria-pressed={floor.id === selected} onClick={() => onSelect(floor.id)}>
      <strong>{index + 1}. {floor.label}</strong>
      <span>Elevation {floor.elevation.toFixed(2)} m</span>
    </button>)}
  </nav>;
}
