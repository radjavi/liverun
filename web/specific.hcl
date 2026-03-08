postgres "main" {}

secret "mapbox_token" {}

secret "better_auth_secret" {
  generated = true
}

secret "google_client_id" {}
secret "google_client_secret" {}

config "better_auth_url" {}

build "web" {
  base = "node"
  command = "npm run build"
}

service "web" {
  build = build.web
  command = "npm start"

  endpoint {
    public = true
  }

  env = {
    PORT                     = port
    DATABASE_URL             = postgres.main.url
    DATABASE_SYNC_URL        = postgres.main.sync.url
    DATABASE_SYNC_SECRET     = postgres.main.sync.secret
    MAPBOX_TOKEN             = secret.mapbox_token
    BETTER_AUTH_SECRET       = secret.better_auth_secret
    BETTER_AUTH_URL          = config.better_auth_url
    GOOGLE_CLIENT_ID         = secret.google_client_id
    GOOGLE_CLIENT_SECRET     = secret.google_client_secret
  }

  dev {
    command = "npm run dev"
  }

  pre_deploy {
    command = "npx drizzle-kit migrate"
  }
}
