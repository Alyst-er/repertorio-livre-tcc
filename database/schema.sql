CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  stage_name VARCHAR(160) NOT NULL DEFAULT '',
  role VARCHAR(100) NOT NULL DEFAULT 'Músico',
  city VARCHAR(160) NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  instruments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bands (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS band_members (
  band_id BIGINT NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (permission IN ('owner','editor','member','viewer')),
  PRIMARY KEY (band_id, user_id)
);

CREATE TABLE IF NOT EXISTS repertoires (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT '',
  event_date DATE,
  event_time TIME,
  location VARCHAR(255) NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  visibility VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','shared','public')),
  owner_id BIGINT NOT NULL REFERENCES users(id),
  band_id BIGINT REFERENCES bands(id) ON DELETE SET NULL,
  share_token VARCHAR(80) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS songs (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL DEFAULT '',
  musical_key VARCHAR(20) NOT NULL DEFAULT '',
  duration VARCHAR(20) NOT NULL DEFAULT '',
  bpm INTEGER CHECK (bpm IS NULL OR bpm BETWEEN 20 AND 300),
  lyrics TEXT NOT NULL DEFAULT '',
  chords TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repertoire_songs (
  repertoire_id BIGINT NOT NULL REFERENCES repertoires(id) ON DELETE CASCADE,
  song_id BIGINT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (repertoire_id, song_id)
);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  repertoire_id BIGINT NOT NULL REFERENCES repertoires(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL DEFAULT '00:00',
  location VARCHAR(255) NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled'
);

CREATE TABLE IF NOT EXISTS comments (
  id BIGSERIAL PRIMARY KEY,
  repertoire_id BIGINT NOT NULL REFERENCES repertoires(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repertoires_owner ON repertoires(owner_id);
CREATE INDEX IF NOT EXISTS idx_repertoires_band ON repertoires(band_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_comments_repertoire ON comments(repertoire_id);
