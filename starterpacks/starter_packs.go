package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type StarterPack struct {
	StarterPack struct {
		URI    string `json:"uri"`
		Cid    string `json:"cid"`
		Record struct {
			Type        string    `json:"$type"`
			CreatedAt   time.Time `json:"createdAt"`
			Description string    `json:"description"`
			Feeds       []any     `json:"feeds"`
			List        string    `json:"list"`
			Name        string    `json:"name"`
			UpdatedAt   time.Time `json:"updatedAt"`
		} `json:"record"`
		Creator struct {
			Did         string    `json:"did"`
			Handle      string    `json:"handle"`
			DisplayName string    `json:"displayName"`
			Avatar      string    `json:"avatar"`
			Labels      []any     `json:"labels"`
			CreatedAt   time.Time `json:"createdAt"`
		} `json:"creator"`
		JoinedAllTimeCount int       `json:"joinedAllTimeCount"`
		JoinedWeekCount    int       `json:"joinedWeekCount"`
		Labels             []any     `json:"labels"`
		IndexedAt          time.Time `json:"indexedAt"`
		Feeds              []any     `json:"feeds"`
		List               struct {
			URI           string    `json:"uri"`
			Cid           string    `json:"cid"`
			Name          string    `json:"name"`
			Purpose       string    `json:"purpose"`
			ListItemCount int       `json:"listItemCount"`
			IndexedAt     time.Time `json:"indexedAt"`
			Labels        []any     `json:"labels"`
		} `json:"list"`
	} `json:"starterPack"`
}

type List struct {
	List struct {
		URI           string    `json:"uri"`
		Cid           string    `json:"cid"`
		Name          string    `json:"name"`
		Purpose       string    `json:"purpose"`
		ListItemCount int       `json:"listItemCount"`
		IndexedAt     time.Time `json:"indexedAt"`
		Labels        []any     `json:"labels"`
		Creator       struct {
			Did         string `json:"did"`
			Handle      string `json:"handle"`
			DisplayName string `json:"displayName"`
			Avatar      string `json:"avatar"`
			Labels      []struct {
				Src string    `json:"src"`
				URI string    `json:"uri"`
				Cid string    `json:"cid"`
				Val string    `json:"val"`
				Cts time.Time `json:"cts"`
			} `json:"labels"`
			CreatedAt   time.Time `json:"createdAt"`
			Description string    `json:"description"`
			IndexedAt   time.Time `json:"indexedAt"`
		} `json:"creator"`
	} `json:"list"`
	Items []struct {
		URI     string `json:"uri"`
		Subject struct {
			Did         string    `json:"did"`
			Handle      string    `json:"handle"`
			DisplayName string    `json:"displayName"`
			Avatar      string    `json:"avatar"`
			Labels      []any     `json:"labels"`
			CreatedAt   time.Time `json:"createdAt"`
			Description string    `json:"description"`
			IndexedAt   time.Time `json:"indexedAt"`
		} `json:"subject"`
	} `json:"items"`
	Cursor string `json:"cursor"`
}

func upsertStarterPackInfo(db *sql.DB, starterPackInfo StarterPack, starterPack string) error {
	statement :=
		`INSERT INTO starter_pack_infos (uri, starter_pack, items, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(uri) DO UPDATE SET
      starter_pack = excluded.starter_pack,
      items = excluded.items,
      updated_at = excluded.updated_at;`

	_, err := db.Exec(statement, starterPackInfo.StarterPack.URI, starterPack, "", time.Now().UnixMicro(), time.Now().UnixMicro())

	if err != nil {
		return err
	}

	return nil
}

func getStarterPack(uri string) (*StarterPack, error) {
	resp, err := http.Get("https://public.api.bsky.app/xrpc/app.bsky.graph.getStarterPack?starterPack=" + uri)
	if err != nil {
		return nil, err
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var starterPack StarterPack
	err = json.Unmarshal(body, &starterPack)
	if err != nil {
		return nil, err
	}
	return &starterPack, nil
}

func getList(uri string, cursor string) (*List, error) {
	cursorQueryParam := ""
	if cursor != "" {
		cursorQueryParam = "&cursor=" + cursor
	}

	resp, err := http.Get("https://public.api.bsky.app/xrpc/app.bsky.graph.getList?limit=100&list=" + uri + cursorQueryParam)
	if err != nil {
		return nil, err
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var list List
	err = json.Unmarshal(body, &list)
	if err != nil {
		return nil, err
	}
	return &list, nil
}

func getListItems(listUri string) (*List, error) {
	cursor := ""
	result := List{}
	first := true

	done := false
	for !done {
		list, err := getList(listUri, cursor)
		if err != nil {
			return nil, err
		}
		if first {
			result = *list
			first = false
		} else {
			result.Items = append(result.Items, list.Items...)
		}
		cursor = list.Cursor
		if cursor == "" {
			done = true
		}
	}

	return &result, nil
}

func handleStarterPacks(w http.ResponseWriter, r *http.Request) {
	starterPack := "at://did:plc:cwx2zxldt3uxciob3nxzhkzr/app.bsky.graph.starterpack/3l7cfdtapwz2l"

	resp, err := http.Get("https://public.api.bsky.app/xrpc/app.bsky.graph.getStarterPack?starterPack=" + starterPack)
	if err != nil {
		fmt.Fprintln(w, "Error:", err)
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Fprintln(w, "Error:", err)
		return
	}

	var starterPackInfo StarterPack
	err = json.Unmarshal(body, &starterPackInfo)
	if err != nil {
		fmt.Fprintln(w, "Error:", err)
		return
	}

	listUri := starterPackInfo.StarterPack.List.URI

	list, err := getListItems(listUri)
	if err != nil {
		fmt.Fprintln(w, "Error:", err)
		return
	}

	fmt.Println(len(list.Items))

	fmt.Fprintln(w, "OK!")
}
