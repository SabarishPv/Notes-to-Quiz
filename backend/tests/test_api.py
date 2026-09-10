"""End-to-end API tests against SQLite with a stubbed model."""

SOURCE = "x" * 250  # comfortably over the minimum source length


def _make_quiz(client, **overrides):
    body = {"text": SOURCE, "question_count": 5, "question_types": ["mcq"]}
    body.update(overrides)
    resp = client.post("/api/quizzes", json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_generate_respects_count_and_types(client):
    quiz = _make_quiz(client, question_count=8, question_types=["mcq", "true_false"])
    assert len(quiz["questions"]) == 8
    assert {q["type"] for q in quiz["questions"]} <= {"mcq", "true_false"}
    assert quiz["attempt_count"] == 0
    assert quiz["config"]["question_count"] == 8


def test_attempts_are_counted_and_kept(client):
    quiz = _make_quiz(client)
    qid = quiz["id"]
    correct = [q["correct_index"] for q in quiz["questions"]]

    first = client.post(f"/api/quizzes/{qid}/attempts", json={"answers": [0, 0, 0, 0, 0]})
    assert first.status_code == 200
    assert first.json()["attempt_count"] == 1

    second = client.post(f"/api/quizzes/{qid}/attempts", json={"answers": correct})
    body = second.json()
    assert body["attempt_count"] == 2
    assert body["score"] == 5
    assert body["best_score"] == 5
    assert len(body["attempts"]) == 2
    assert [a["number"] for a in body["attempts"]] == [1, 2]


def test_folders_group_quizzes_and_cascade_delete(client):
    folder = client.post("/api/folders", json={"name": "Science"}).json()
    fid = folder["id"]

    _make_quiz(client, folder_id=fid)
    _make_quiz(client, folder_id=fid)
    _make_quiz(client)  # unfiled

    listing = client.get("/api/folders").json()
    assert listing["items"][0]["quiz_count"] == 2
    assert listing["unfiled_count"] == 1

    in_folder = client.get(f"/api/quizzes?folder={fid}").json()["items"]
    assert len(in_folder) == 2

    assert client.delete(f"/api/folders/{fid}").status_code == 204
    remaining = client.get("/api/quizzes?folder=all").json()["items"]
    assert len(remaining) == 1  # only the unfiled one survived


def test_move_quiz_between_folders(client):
    a = client.post("/api/folders", json={"name": "A"}).json()["id"]
    quiz = _make_quiz(client)
    moved = client.patch(f"/api/quizzes/{quiz['id']}", json={"folder_id": a}).json()
    assert moved["folder_id"] == a
    unfiled = client.patch(f"/api/quizzes/{quiz['id']}", json={"clear_folder": True}).json()
    assert unfiled["folder_id"] is None


def test_share_link_flow_with_guest(client):
    quiz = _make_quiz(client)
    qid = quiz["id"]
    correct = [q["correct_index"] for q in quiz["questions"]]

    token = client.post(f"/api/quizzes/{qid}/share").json()["share_token"]
    assert token

    public = client.get(f"/api/shared/{token}").json()
    assert "correct_index" not in public["questions"][0]
    assert len(public["questions"]) == 5

    graded = client.post(
        f"/api/shared/{token}/attempts",
        json={"answers": correct, "guest_name": "Sam"},
    ).json()
    assert graded["score"] == 5
    assert graded["review"][0]["correct_index"] is not None

    detail = client.get(f"/api/quizzes/{qid}").json()
    assert detail["attempt_count"] == 1
    assert detail["score"] is None  # a guest take does not touch the owner's cached score
    guest_attempt = detail["attempts"][0]
    assert guest_attempt["taker"] == "guest"
    assert guest_attempt["taker_name"] == "Sam"

    client.delete(f"/api/quizzes/{qid}/share")
    assert client.get(f"/api/shared/{token}").status_code == 404


def test_regenerate_resets_attempts(client):
    quiz = _make_quiz(client)
    qid = quiz["id"]
    client.post(f"/api/quizzes/{qid}/attempts", json={"answers": [0, 0, 0, 0, 0]})
    regenerated = client.post(f"/api/quizzes/{qid}/regenerate", json={}).json()
    assert regenerated["attempt_count"] == 0
    assert regenerated["attempts"] == []


def test_generate_rejects_short_source(client):
    resp = client.post("/api/quizzes", json={"text": "too short", "question_types": ["mcq"]})
    assert resp.status_code == 422


def test_generate_rejects_empty_type_list(client):
    resp = client.post("/api/quizzes", json={"text": SOURCE, "question_types": []})
    assert resp.status_code == 422
