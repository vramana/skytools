package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strconv"
	"time"

	"github.com/gorilla/websocket"
	_ "github.com/mattn/go-sqlite3"
)

func saveMessage(db *sql.DB, did string, message string, time_us int64) {
	_, err := db.Exec("INSERT INTO starter_packs (did, message, time_us) VALUES (?, ?, ?)", did, message, time_us)
	if err != nil {
		panic(err)
	}
}

func main() {
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	db, err := sql.Open("sqlite3", "/tmp/blootools.db")
	if err != nil {
		panic(err)
	}

	db.Exec("pragma journal_mode=wal")
	_, err = db.Exec("CREATE TABLE IF NOT EXISTS starter_packs (did TEXT, message TEXT, time_us INTEGER)")
	if err != nil {
		panic(err)
	}

	_, err = db.Exec("CREATE INDEX IF NOT EXISTS starter_packs_time_us ON starter_packs (time_us)")
	if err != nil {
		panic(err)
	}

	last_time_us := sql.NullInt64{}
	cursor := int64(1725149758000000)
	row := db.QueryRow("SELECT MAX(time_us) FROM starter_packs")
	if row.Err() != nil {
		panic(row.Err())
	}
	err = row.Scan(&last_time_us)
	if err != nil {
		if err != sql.ErrNoRows {
			panic(err)
		}
	} else {
		cursor = last_time_us.Int64 - 1000*1000
	}

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

	done := make(chan struct{})

	go func() {
		defer close(done)
		i := 0
		previousCursor := int64(cursor)

		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				log.Println("read:", err)
				return
			}
			var d JetstreamMessage

			err = json.Unmarshal(message, &d)
			if err != nil {
				log.Println("unmarshal:", err)
				return
			}

			if d.Kind != "commit" {
				continue
			}

			if d.TimeUs > previousCursor+60*60*1000*1000 {
				previousCursor = d.TimeUs
				t := time.UnixMicro(d.TimeUs)
				fmt.Println("New hour", t.Format(time.RFC3339))
			}

			var starterpack StarterPackCommit
			err = json.Unmarshal(message, &starterpack)
			if err != nil {
				var dd map[string]interface{}
				err = json.Unmarshal(message, &dd)
				if err != nil {
					log.Println("unmarshal:", err)
					return
				}

				data, _ := json.MarshalIndent(dd, "", "  ")
				fmt.Println(string(data))

				i++
				fmt.Println("Failed to unmarshal", i, "messages")
				continue
			}

			saveMessage(db, starterpack.Did, string(message), d.TimeUs)
		}
	}()

	for {
		select {
		case <-interrupt:
			fmt.Println("Interrupted")
			return
		}
	}
}
