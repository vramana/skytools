package main

import (
	"context"
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
		fmt.Println("New hour", t.Format(time.RFC3339))

		return cursor
	}

	return previousCursor
}

func main() {
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	server := NewServer()

	log.Println("Starting at", server.cursor)

	c, _, err := websocket.DefaultDialer.Dial(
		"wss://jetstream1.us-east.bsky.network/subscribe"+
			"?wantedCollections=app.bsky.graph.starterpack&cursor="+
			strconv.FormatInt(server.cursor, 10),
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

			_, err = parseCommit(message)
			if err != nil {
				continue
			}

			err = server.writeStarterPackCommit(message)
			if err != nil {
				i++
				fmt.Println("Failed to unmarshal", i, "message", string(message))
				continue
			}
		}
	}()

	r := mux.NewRouter()

	r.HandleFunc("/api/starter-packs", handleStarterPacks)

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
