import { Link } from "@remix-run/react";

export default function NoteIndexPage() {
  return (
    <p className="text-muted-foreground">
      No note selected. Select a note on the left, or{" "}
      <Link to="new" className="text-foreground underline">
        create a new note.
      </Link>
    </p>
  );
}
