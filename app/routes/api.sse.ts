import type { LoaderFunctionArgs } from "@remix-run/node";
import { eventStream } from "remix-utils/sse/server";
import { catchError, filter, map, tap } from "rxjs";

import { chat$ } from "~/chat.server";
import { requireUserId } from "~/session.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  return eventStream(request.signal, function setup(send) {
    const sub = chat$
      .pipe(
        filter((evt) => evt.userId === userId),
        map((evt) => ({
          event: "chat",
          data: JSON.stringify(evt),
        })),
        tap(send),
        catchError((e, caught) => {
          console.error("Error emitted from chat$ subject.", e);
          return caught;
        }),
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  });
};
