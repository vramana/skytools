package main

import (
	"database/sql"
	"encoding/json"
	"os"
	"sync"
	"time"
)

type Server struct {
	db              *sql.DB
	mu              sync.Mutex
	cursor          int64
	starterPackChan chan string
}

func initDB() (*sql.DB, error) {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "/tmp/skytools.db"
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	db.Exec("pragma journal_mode=wal")

	_, err = db.Exec("CREATE TABLE IF NOT EXISTS starter_packs (did TEXT, message TEXT, time_us INTEGER)")
	if err != nil {
		return nil, err
	}

	_, err = db.Exec("CREATE INDEX IF NOT EXISTS starter_packs_time_us ON starter_packs (time_us)")
	if err != nil {
		return nil, err
	}

	_, err = db.Exec("CREATE TABLE IF NOT EXISTS starter_pack_infos (uri TEXT PRIMARY KEY, starter_pack TEXT, items TEXT, created_at INTEGER, updated_at INTEGER)")
	if err != nil {
		return nil, err
	}

	return db, nil
}

func NewServer() *Server {
	db, err := initDB()
	if err != nil {
		panic(err)
	}

	cursor := readCursor(db)

	return &Server{
		db,
		sync.Mutex{},
		cursor,
		make(chan string),
	}
}

func readCursor(db *sql.DB) int64 {
	last_time_us := sql.NullInt64{}
	cursor := int64(1725149758000000)
	row := db.QueryRow("SELECT MAX(time_us) FROM starter_packs")
	if row.Err() != nil {
		panic(row.Err())
	}
	err := row.Scan(&last_time_us)
	if err != nil {
		if err != sql.ErrNoRows {
			panic(err)
		}
	} else {
		if last_time_us.Valid {
			cursor = last_time_us.Int64 - 1000*1000
		}
	}

	return cursor
}

func (server *Server) writeStarterPackCommit(message []byte) error {
	var commit StarterPackCommit

	err := json.Unmarshal(message, &commit)
	if err != nil {
		return err
	}

	server.cursor = updateAndPrintCursor(commit.TimeUs, server.cursor)
	server.saveMessage(commit.Did, string(message), commit.TimeUs)

	starterPackUri := "at://" + commit.Did + "/app.bsky.graph.starterpack/" + commit.Commit.Rkey
	server.starterPackChan <- starterPackUri

	return nil
}

func (server *Server) saveMessage(did string, message string, time_us int64) {
	server.mu.Lock()
	defer server.mu.Unlock()
	_, err := server.db.Exec("INSERT INTO starter_packs (did, message, time_us) VALUES (?, ?, ?)", did, message, time_us)
	if err != nil {
		panic(err)
	}
}

func (server *Server) nextStarterPack() string {
	starterPack := <-server.starterPackChan

	return starterPack

}

func (server *Server) writeStarterPackInfo(starterPack *StarterPack, list *List) error {
  server.mu.Lock()
  defer server.mu.Unlock()
	statement :=
		`INSERT INTO starter_pack_infos (uri, starter_pack, items, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(uri) DO UPDATE SET
      starter_pack = excluded.starter_pack,
      items = excluded.items,
      updated_at = excluded.updated_at;`

	starterPackString, err := json.Marshal(starterPack)
	if err != nil {
		return err
	}
	listString, err := json.Marshal(list)
	if err != nil {
		return err
	}

	_, err = server.db.Exec(statement, starterPack.StarterPack.URI, starterPackString, listString, time.Now().UnixMicro(), time.Now().UnixMicro())
	if err != nil {
		return err
	}

	return nil
}
