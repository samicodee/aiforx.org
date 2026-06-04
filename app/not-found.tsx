import { Header } from "@/app/components/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="program-placeholder">
        <p className="kicker">Page not found</p>
        <h1>That AIforSaudi page does not exist yet.</h1>
        <p>Choose a cohort track from the homepage.</p>
        <a className="button primary" href="/#tracks">
          Back to Tracks
        </a>
      </main>
    </>
  );
}
