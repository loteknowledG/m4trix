import json
import time

from samus_manus_mvp import heartbeat


def test_auto_approval_speaks(tmp_path, monkeypatch):
    tmp_dir = tmp_path / 'hb'
    tmp_dir.mkdir()

    # create a pending auto_approve task
    tasks = [{"id": "task-1", "task": "Take a screenshot", "status": "pending", "created_at": int(time.time()), "auto_approve": True}]
    (tmp_dir / 'tasks.json').write_text(json.dumps({'tasks': tasks}))
    (tmp_dir / 'approval_audit.log').write_text('')

    monkeypatch.setattr(heartbeat, 'BASE', tmp_dir)
    monkeypatch.setattr(heartbeat, 'TASKS_PATH', tmp_dir / 'tasks.json')
    monkeypatch.setattr(heartbeat, 'STATE_PATH', tmp_dir / 'heartbeat_state.json')

    called = []

    def fake_speak(msg):
        called.append(msg)

    monkeypatch.setattr(heartbeat, 'speak', fake_speak)

    # run a one-shot heartbeat
    heartbeat.check_once(announce=True, interval=1, global_auto_apply=False, mode='whitelist')

    # should have spoken at least one Auto-approved message
    assert any('Auto-approved' in c for c in called)
    # audit entry should include question + answer
    lines = [l for l in (tmp_dir / 'approval_audit.log').read_text().splitlines() if l.strip()]
    assert lines
    e = json.loads(lines[-1])
    assert e.get('question') and e.get('answer')


def test_no_auto_status_speaks(tmp_path, monkeypatch):
    tmp_dir = tmp_path / 'hb2'
    tmp_dir.mkdir()

    # no pending tasks
    (tmp_dir / 'tasks.json').write_text(json.dumps({'tasks': []}))
    (tmp_dir / 'approval_audit.log').write_text('')

    monkeypatch.setattr(heartbeat, 'BASE', tmp_dir)
    monkeypatch.setattr(heartbeat, 'TASKS_PATH', tmp_dir / 'tasks.json')
    monkeypatch.setattr(heartbeat, 'STATE_PATH', tmp_dir / 'heartbeat_state.json')

    msgs = []
    monkeypatch.setattr(heartbeat, 'speak', lambda m: msgs.append(m))

    heartbeat.check_once(announce=True, interval=1, global_auto_apply=False, mode='whitelist')

    # should have a status readout indicating no auto-approvals
    assert any('No auto-approvals' in m or 'Pending tasks' in m for m in msgs)