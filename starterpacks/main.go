package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	_ "github.com/mattn/go-sqlite3"
)

type CatchAll struct{}

func (c CatchAll) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "OK!")
}

func saveMessage(db *sql.DB, did string, message string, time_us int64) {
	_, err := db.Exec("INSERT INTO starter_packs (did, message, time_us) VALUES (?, ?, ?)", did, message, time_us)
	if err != nil {
		panic(err)
	}
}

func storeStarterPack(db *sql.DB, message []byte) error {
	var starterpack StarterPackCommit
	err := json.Unmarshal(message, &starterpack)
	if err != nil {
		return err
	}

	saveMessage(db, starterpack.Did, string(message), starterpack.TimeUs)
	return nil
}

func initDB() (*sql.DB, error) {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "/tmp/blootools.db"
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}
	_, err = db.Exec("CREATE TABLE IF NOT EXISTS starter_packs (did TEXT, message TEXT, time_us INTEGER)")
	if err != nil {
		return nil, err
	}

	_, err = db.Exec("CREATE INDEX IF NOT EXISTS starter_packs_time_us ON starter_packs (time_us)")
	if err != nil {
		return nil, err
	}

	return db, nil
}

func parseCommit(message []byte) (*JetstreamMessage, error) {
	var d JetstreamMessage

	err := json.Unmarshal(message, &d)
	if err != nil {
		return nil, err
	}

	if d.Kind != "commit" {
		return nil, errors.New("not a commit")
	}
	return &d, nil
}

func updateAndPrintCursor(cursor, previousCursor int64) int64 {
	if cursor > previousCursor+60*60*1000*1000 {
		previousCursor = cursor
		t := time.UnixMicro(cursor)
		fmt.Println("New minute", t.Format(time.RFC3339))

		return cursor
	}

	return previousCursor
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
		cursor = last_time_us.Int64 - 1000*1000
	}

	return cursor
}

func main() {
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	db, err := initDB()

	if err != nil {
		panic(err)
	}

	cursor := readCursor(db)

	fmt.Println("Starting at", cursor)

	c, _, err := websocket.DefaultDialer.Dial(
		"wss://jetstream1.us-east.bsky.network/subscribe"+
			"?wantedCollections=app.bsky.graph.starterpack&cursor="+
			strconv.FormatInt(cursor, 10),
		nil)
	if err != nil {
		log.Fatal("dial:", err)
	}
	defer c.Close()

	go func() {
		i := 0
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				log.Println("read:", err)
				return
			}

			commit, err := parseCommit(message)
			if err != nil {
				continue
			}

			fmt.Println("Got message", commit)

			cursor = updateAndPrintCursor(commit.TimeUs, cursor)

			err = storeStarterPack(db, message)
			if err != nil {
				i++
				fmt.Println("Failed to unmarshal", i, "message", string(message))
				continue
			}
		}
	}()

	r := mux.NewRouter()

	r.PathPrefix("/").Handler(CatchAll{})

	srv := &http.Server{
		Handler: r,
		Addr:    "127.0.0.1:3000",
		// Good practice: enforce timeouts for servers you create!
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil {
			log.Fatal(err)
		}
	}()

	<-interrupt
	srv.Shutdown(context.Background())

	log.Println("shutting down")
	os.Exit(0)
}
