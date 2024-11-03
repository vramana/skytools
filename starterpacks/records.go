package main

import (
	"time"
)

type StarterPackCommit struct {
	Commit struct {
		Cid        string `json:"cid,omitempty"`
		Collection string `json:"collection,omitempty"`
		Operation  string `json:"operation,omitempty"`
		Record     struct {
			Type        string    `json:"$type,omitempty"`
			CreatedAt   time.Time `json:"createdAt,omitempty"`
			Description string    `json:"description,omitempty"`
			Feeds       []struct {
				Avatar  string `json:"avatar,omitempty"`
				Cid     string `json:"cid,omitempty"`
				Creator struct {
					Associated struct {
						Chat struct {
							AllowIncoming string `json:"allowIncoming,omitempty"`
						} `json:"chat,omitempty"`
					} `json:"associated,omitempty"`
					Avatar      string    `json:"avatar,omitempty"`
					CreatedAt   time.Time `json:"createdAt,omitempty"`
					Description string    `json:"description,omitempty"`
					Did         string    `json:"did,omitempty"`
					DisplayName string    `json:"displayName,omitempty"`
					Handle      string    `json:"handle,omitempty"`
					IndexedAt   time.Time `json:"indexedAt,omitempty"`
					Labels      []any     `json:"labels,omitempty"`
					Viewer      struct {
						BlockedBy bool   `json:"blockedBy,omitempty"`
						Following string `json:"following,omitempty"`
						Muted     bool   `json:"muted,omitempty"`
					} `json:"viewer,omitempty"`
				} `json:"creator,omitempty"`
				Description string    `json:"description,omitempty"`
				Did         string    `json:"did,omitempty"`
				DisplayName string    `json:"displayName,omitempty"`
				IndexedAt   time.Time `json:"indexedAt,omitempty"`
				Labels      []any     `json:"labels,omitempty"`
				LikeCount   int       `json:"likeCount,omitempty"`
				URI         string    `json:"uri,omitempty"`
				Viewer      struct {
					Like string `json:"like,omitempty"`
				} `json:"viewer,omitempty"`
			} `json:"feeds,omitempty"`
			List      string    `json:"list,omitempty"`
			Name      string    `json:"name,omitempty"`
			UpdatedAt time.Time `json:"updatedAt,omitempty"`
		} `json:"record,omitempty"`
		Rev  string `json:"rev,omitempty"`
		Rkey string `json:"rkey,omitempty"`
		Type string `json:"type,omitempty"`
	} `json:"commit,omitempty"`
	Did    string `json:"did,omitempty"`
	Kind   string `json:"kind,omitempty"`
	TimeUs int64  `json:"time_us,omitempty"`
	Type   string `json:"type,omitempty"`
}

type JetstreamMessage struct {
	Did    string `json:"did,omitempty"`
	Kind   string `json:"kind,omitempty"`
	TimeUs int64  `json:"time_us,omitempty"`
	Type   string `json:"type,omitempty"`
}
