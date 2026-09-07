/// <reference types="@cloudflare/workers-types" />

// Optional starter binding; this calculator does not require a database.
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
  }
}
