postgres "main" {}

secret "mapbox_token" {}

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
  }

  dev {
    command = "npm run dev"
  }

  pre_deploy {
    command = "npx drizzle-kit migrate"
  }
}
