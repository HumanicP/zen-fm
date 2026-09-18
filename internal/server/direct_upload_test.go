package server

import (
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func directUploadRequest(a *testAPI, cookie *http.Cookie, csrf, target, body string) *http.Request {
	request := httptest.NewRequest(http.MethodPut, "/api/v1/files/content?"+url.Values{"path": {target}}.Encode(), strings.NewReader(body))
	request.AddCookie(cookie)
	request.Header.Set("X-ZenFM-CSRF", csrf)
	request.Header.Set("Content-Type", "application/octet-stream")
	return request
}

func TestDirectUploadConflictIsExplicitAndAtomic(t *testing.T) {
	a := newTestAPI(t)
	cookie, csrf := a.finishSetup()
	if _, err := a.files.Write("existing.txt", strings.NewReader("old"), false); err != nil {
		t.Fatal(err)
	}
	request := directUploadRequest(a, cookie, csrf, "/existing.txt", "new")
	request.Header.Set("If-None-Match", "*")
	if response := serveTestRequest(a, request); response.Code != http.StatusConflict {
		t.Fatalf("initial-only conflict: %d %s", response.Code, response.Body.String())
	}
	data, _ := a.files.ReadContent("existing.txt")
	if string(data) != "old" {
		t.Fatalf("conflict modified destination: %q", data)
	}
	request = directUploadRequest(a, cookie, csrf, "/existing.txt", "new")
	if response := serveTestRequest(a, request); response.Code != http.StatusNoContent {
		t.Fatalf("explicit replacement request: %d %s", response.Code, response.Body.String())
	}
	data, _ = a.files.ReadContent("existing.txt")
	if string(data) != "new" {
		t.Fatalf("replacement = %q", data)
	}
}

func TestDirectUploadAcceptsGzipBody(t *testing.T) {
	a := newTestAPI(t)
	cookie, csrf := a.finishSetup()
	var compressed bytes.Buffer
	writer := gzip.NewWriter(&compressed)
	if _, err := writer.Write([]byte("compressed upload")); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	request := directUploadRequest(a, cookie, csrf, "/compressed.txt", compressed.String())
	request.Header.Set("Content-Encoding", "gzip")
	if response := serveTestRequest(a, request); response.Code != http.StatusCreated {
		t.Fatalf("gzip upload: %d %s", response.Code, response.Body.String())
	}
	if data, err := a.files.ReadContent("compressed.txt"); err != nil || string(data) != "compressed upload" {
		t.Fatalf("gzip content: %q %v", data, err)
	}

	corruptBody := append([]byte(nil), compressed.Bytes()...)
	corruptBody[len(corruptBody)-1] ^= 0xff
	corrupt := directUploadRequest(a, cookie, csrf, "/corrupt.txt", string(corruptBody))
	corrupt.Header.Set("Content-Encoding", "gzip")
	if response := serveTestRequest(a, corrupt); response.Code != http.StatusBadRequest {
		t.Fatalf("corrupt gzip: %d %s", response.Code, response.Body.String())
	}
	invalid := directUploadRequest(a, cookie, csrf, "/invalid.txt", "not gzip")
	invalid.Header.Set("Content-Encoding", "gzip")
	if response := serveTestRequest(a, invalid); response.Code != http.StatusBadRequest {
		t.Fatalf("invalid gzip: %d %s", response.Code, response.Body.String())
	}
	unsupported := directUploadRequest(a, cookie, csrf, "/unsupported.txt", "data")
	unsupported.Header.Set("Content-Encoding", "br")
	if response := serveTestRequest(a, unsupported); response.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("unsupported encoding: %d %s", response.Code, response.Body.String())
	}
}

func TestDirectUploadLimitConcurrencyAndCancellation(t *testing.T) {
	a := newTestAPI(t)
	cookie, csrf := a.finishSetup()
	tooLarge := directUploadRequest(a, cookie, csrf, "/large.bin", "")
	tooLarge.ContentLength = a.server.uploads.maxLength + 1
	if response := serveTestRequest(a, tooLarge); response.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("declared oversize: %d %s", response.Code, response.Body.String())
	}
	if _, err := a.files.Entry("large.bin"); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("oversize target exists: %v", err)
	}
	for range cap(a.server.uploads.slots) {
		a.server.uploads.slots <- struct{}{}
	}
	blocked := directUploadRequest(a, cookie, csrf, "/blocked.bin", "data")
	if response := serveTestRequest(a, blocked); response.Code != http.StatusTooManyRequests {
		t.Fatalf("concurrency ceiling: %d", response.Code)
	}
	for range cap(a.server.uploads.slots) {
		<-a.server.uploads.slots
	}
	cancelled := directUploadRequest(a, cookie, csrf, "/cancelled.bin", "data")
	ctx, cancel := context.WithCancel(cancelled.Context())
	cancel()
	cancelled = cancelled.WithContext(ctx)
	if response := serveTestRequest(a, cancelled); response.Code != http.StatusRequestTimeout {
		t.Fatalf("cancelled upload: %d %s", response.Code, response.Body.String())
	}
	if _, err := a.files.Entry("cancelled.bin"); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("cancelled target exists: %v", err)
	}
}
