import { Header } from "@/app/components/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="program-placeholder">
        <p className="kicker">Page not found</p>
        <h1>That AIforX page does not exist yet.</h1>
        <p>Choose a program track from the homepage.</p>
        <a className="button primary" href="/#programs">
          Back to Programs
        </a>
      </main>
    </>
  );
}
