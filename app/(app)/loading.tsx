export default function Loading() {
  return (
    <div className="loading" role="status" aria-label="Loading">
      <span className="skeleton title" />
      <span className="skeleton line" />
      <span className="skeleton panel" />
    </div>
  );
}
