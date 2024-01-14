import { MagicWandIcon, Pencil1Icon } from "@radix-ui/react-icons";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, NavLink, Outlet, useLoaderData } from "@remix-run/react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getNoteListItems } from "~/models/note.server";
import { requireUserId } from "~/session.server";
import { useUser } from "~/utils";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const noteListItems = await getNoteListItems({ userId });
  return json({ noteListItems });
};

export default function NotesPage() {
  const data = useLoaderData<typeof loader>();
  const user = useUser();

  return (
    <div className="grid grid-cols-1 grid-rows-[auto,1fr] min-h-screen">
      <header className="sticky top-0 flex h-12 items-center justify-between bg-background/90 border-b backdrop-blur-md px-4">
        <h1 className="text-lg font-bold">
          <Link to=".">Notes</Link>
        </h1>
        <p>{user.email}</p>
        <Form action="/logout" method="post">
          <Button variant="outline" size="sm" type="submit">
            Logout
          </Button>
        </Form>
      </header>
      <main className="grid grid-cols-[auto,1fr] grid-rows-1">
        <div className="w-80 border-r bg-muted/10">
          <div className="px-4 py-4">
            <Button
              variant="default"
              className="[&.active]:bg-foreground/10 w-full"
              asChild
            >
              <Link to="new">+ New Note</Link>
            </Button>
          </div>
          <Separator />
          {data.noteListItems.length === 0 ? (
            <p className="p-4">No notes yet</p>
          ) : (
            <ol className="divide-y">
              <Button
                variant="ghost"
                className="[&.active]:bg-foreground/10 rounded-none w-full justify-start text-emerald-200"
                asChild
              >
                <NavLink to="qna">
                  <MagicWandIcon className="inline-block mr-2" /> AI Q&A
                </NavLink>
              </Button>
              {data.noteListItems.map((note) => (
                <li key={note.id}>
                  <Button
                    variant="ghost"
                    className="[&.active]:bg-foreground/10 rounded-none w-full justify-start"
                    asChild
                  >
                    <NavLink to={note.id}>
                      <Pencil1Icon className="inline-block mr-2" /> {note.title}
                    </NavLink>
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
