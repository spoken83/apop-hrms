import { cookies } from "next/headers";
import { ALL_ENTITIES, ENTITY_COOKIE } from "./entity-constants";

export { ALL_ENTITIES, ENTITY_COOKIE };

// Selected entity scope for the admin console. "all" is allowed for
// dashboard and reports only (UI/UX spec §4.1).
export async function getSelectedEntityId(): Promise<string> {
  const store = await cookies();
  return store.get(ENTITY_COOKIE)?.value ?? ALL_ENTITIES;
}
