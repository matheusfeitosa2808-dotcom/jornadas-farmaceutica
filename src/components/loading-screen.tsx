export default function LoadingScreen({
  message = "Preparando sua jornada…",
}: {
  message?: string;
}) {
  return (
    <main id="main" className="journey-loading" aria-busy="true">
      <div className="journey-loading__content">
        <div className="journey-loading__coin" aria-hidden="true">
          <div className="journey-loading__spin">
            <span className="journey-loading__face journey-loading__face--front" />
            <span className="journey-loading__face journey-loading__face--back" />
          </div>
        </div>
        <p
          className="journey-loading__message"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      </div>
    </main>
  );
}
