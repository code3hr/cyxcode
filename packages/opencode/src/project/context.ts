import { Context } from "../util/context"
import type { Shape } from "./instance"

// Shared without loading project services, so path resolution can use the active instance.
export const context = Context.create<Shape>("instance")
