export function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="/#top" aria-label="AIforX home">
        <span className="wordmark">
          AIfor<span>X</span>
        </span>
        <span className="tagline">AI FOR REAL WORK.</span>
      </a>
      <nav className="nav" aria-label="Primary navigation">
        <a href="/#programs">Programs</a>
        <a href="/#why">Why</a>
        <a href="/#workflows">Workflows</a>
        <a href="/#apply">Apply</a>
      </nav>
      <a className="header-cta" href="/#apply">
        Apply
      </a>
    </header>
  );
}
