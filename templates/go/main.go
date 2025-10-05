package main

import (
	"fmt"
	"net/http"
)

func main() {
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","service":"go"}`))
	})
	port := "3002"
	fmt.Println("[go] service listening on :" + port)
	_ = http.ListenAndServe(":"+port, nil)
}
