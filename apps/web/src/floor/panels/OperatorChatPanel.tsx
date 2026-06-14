import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useGateway } from '../../runtime/RuntimeContext';
import { PanelChrome } from './PanelChrome';
import { emptyTranscript, transcriptReducer, type OperatorTurn } from './operatorTranscript';

/**
 * Chat — a ChatGPT/Claude-style surface: messages stack from the bottom; the
 * composer is one rounded box with the send button embedded; each turn shows a
 * transient "thinking…" indicator until the reply streams in.
 *
 * Wire model is unchanged (operatorTranscript reducer): submit → accepted →
 * delta* → completed, streamed over OfficeEvents. Inert: no execution authority.
 */
export function OperatorChatPanel({ onClose }: { onClose: () => void }) {
  const gateway = useGateway();
  const [state, dispatch] = useReducer(transcriptReducer, emptyTranscript);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const localSeq = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!gateway.subscribeOfficeEvents) return;
    return gateway.subscribeOfficeEvents((event) => dispatch({ kind: 'event', event }));
  }, [gateway]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.turns]);

  // Auto-grow up to ~10 lines, then the textarea scrolls (styled scrollbar).
  function autosize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 188)}px`;
  }

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const localId = `L${(localSeq.current += 1)}`;
    dispatch({ kind: 'submit', localId, text: trimmed });
    setText('');
    setPending(true);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    try {
      const accepted = await gateway.sendOperatorMessage({
        text: trimmed,
        source: 'web',
        target: 'orchestrator',
        floorId: 'trading-lab',
      });
      dispatch({
        kind: 'accepted',
        localId,
        operatorMessageId: accepted.operatorMessageId,
        conversationId: accepted.conversationId,
      });
    } catch (err) {
      dispatch({ kind: 'submit_failed', localId, error: err instanceof Error ? err.message : 'send failed' });
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send();
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const empty = state.turns.length === 0;

  return (
    <PanelChrome title="Chat" onClose={onClose} flush>
      <div className="chat">
        <div className="chat__scroll" ref={scrollRef}>
          {empty ? (
            <div className="chat__empty">
              <div className="chat__empty-orb" aria-hidden="true" />
              <p className="chat__empty-title">No messages here yet…</p>
              <p className="chat__empty-sub">Ask about agent status, hypotheses, or backtests.</p>
            </div>
          ) : (
            <ul className="chat__list">
              {state.turns.map((turn) => (
                <ChatTurn key={turn.localId} turn={turn} />
              ))}
            </ul>
          )}
        </div>

        <form className="chat__composer" onSubmit={onSubmit}>
          <div className="chat__box">
            <textarea
              ref={inputRef}
              className="chat__input"
              value={text}
              placeholder="Type a message…"
              onChange={(e) => {
                setText(e.target.value);
                autosize(e.target);
              }}
              onKeyDown={onKeyDown}
              rows={1}
              aria-label="Type a message"
            />
            <div className="chat__box-bar">
              <span className="chat__hint">Enter to send · Shift+Enter for a new line</span>
              <button
                type="submit"
                className="chat__send"
                disabled={pending || !text.trim()}
                aria-label="Send message"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 19.5V6" />
                  <path d="M6.5 11.5 12 6l5.5 5.5" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
    </PanelChrome>
  );
}

function ChatTurn({ turn }: { turn: OperatorTurn }) {
  const typing = (turn.status === 'pending' || turn.status === 'streaming') && !turn.replyText;
  return (
    <li className="chat__turn">
      <div className="chat__msg chat__msg--user">
        <div className="chat__bubble">{turn.userText}</div>
      </div>

      {turn.status === 'failed' ? (
        <div className="chat__msg chat__msg--assistant">
          <span className="chat__avatar" aria-hidden="true">◆</span>
          <div className="chat__bubble chat__bubble--error">⚠ {turn.error ?? 'failed'}</div>
        </div>
      ) : typing ? (
        <div className="chat__msg chat__msg--assistant">
          <span className="chat__avatar" aria-hidden="true">◆</span>
          <div className="chat__bubble chat__bubble--typing">
            <span className="chat__status">{turn.status === 'pending' ? 'connecting' : 'thinking'}</span>
            <span className="chat__dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
        </div>
      ) : (
        <div className="chat__msg chat__msg--assistant">
          <span className="chat__avatar" aria-hidden="true">◆</span>
          <div className="chat__bubble">
            {turn.replyText}
            {turn.status === 'streaming' && <span className="chat__caret" aria-hidden="true" />}
          </div>
        </div>
      )}
    </li>
  );
}
