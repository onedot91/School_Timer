import { useEffect, useId, useState } from 'react';
import { STUDENT_STOCKS, type StudentStockMarket } from '../../lib/studentEconomy';
import {
  buildStockMarketWeekImportTemplate,
  parseStockMarketWeekImport,
  type StockMarketWeekImportEntry,
  type StockMarketWeekImportResult,
} from '../../lib/stockMarketWeekImport';

export default function TeacherStockWeekImport({ dateKey, market, readOnly, onRegister }: {
  readonly dateKey: string;
  readonly market: StudentStockMarket;
  readonly readOnly: boolean;
  readonly onRegister: (entries: readonly StockMarketWeekImportEntry[]) => void;
}) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<StockMarketWeekImportResult | null>(null);
  const [status, setStatus] = useState('');
  const inputId = useId();
  useEffect(() => {
    setResult(null);
    setStatus('');
  }, [dateKey]);
  const preview = result?.ok ? result.entries : null;
  const overwriteCount = preview?.filter(entry => market[entry.stockId]?.some(saved => saved.dateKey === entry.dateKey)).length ?? 0;
  const updateText = (value: string) => {
    setText(value);
    setResult(null);
    setStatus('');
  };
  const register = () => {
    if (!preview || readOnly) return;
    onRegister(preview);
    setResult(null);
    setStatus('월~금 20개 등락·이유를 반영했습니다.');
  };

  return <div className="teacher-stock-import">
    <div className={`teacher-stock-import-body${result ? ' has-result' : ''}`}>
      <div className="teacher-stock-import-entry">
        <div className="teacher-stock-import-format">
          <label htmlFor={inputId}>날짜 | 종목 | 등락 | 이유</label>
          <button type="button" onClick={() => updateText(buildStockMarketWeekImportTemplate(dateKey))}>입력 양식</button>
        </div>
        <p>월~금 20행 · 등락 -50~+50%, 10% 단위 · 이유 선택(120자)</p>
        <textarea
          id={inputId}
          aria-label="주간 증권 등록 텍스트"
          value={text}
          onChange={event => updateText(event.target.value)}
          rows={5}
          spellCheck={false}
          placeholder={[
            `${dateKey} | 냠냠푸드 | +10% | 신제품이 인기를 끌었어요.`,
            `${dateKey} | 팡팡게임즈 | -10% | 게임 이용자가 줄었어요.`,
            `${dateKey} | 척척테크 | +20% | 새 기술을 발표했어요.`,
            `${dateKey} | 반짝엔터 | 0% | 새 소식이 없었어요.`,
          ].join('\n')}
        />
        <div className="teacher-stock-import-actions">
          <button type="button" disabled={!text.trim()} onClick={() => { setResult(parseStockMarketWeekImport(text, dateKey)); setStatus(''); }}>미리보기</button>
        </div>
      </div>
      {result ? <div className="teacher-stock-import-result">
        {result?.ok === false ? <ul className="teacher-stock-import-errors" role="alert">{result.errors.map((error, index) => <li key={index}>{error}</li>)}</ul> : null}
        {preview ? <>
          <div className="teacher-stock-import-actions">
            <p className="teacher-stock-import-notice">{overwriteCount > 0 ? `${overwriteCount}개 항목 덮어쓰기` : '월~금 · 20개 항목'}</p>
            <button type="button" className="is-primary" disabled={readOnly} onClick={register}>20개 일괄 등록</button>
          </div>
          <div className="teacher-stock-import-preview" tabIndex={0} aria-label="주간 증권 등록 미리보기">
            <table>
              <thead><tr><th scope="col">날짜</th><th scope="col">종목</th><th scope="col">등락</th><th scope="col">이유</th></tr></thead>
              <tbody>{preview.map(entry => <tr key={`${entry.dateKey}:${entry.stockId}`}>
                <td>{entry.dateKey}</td><td>{STUDENT_STOCKS.find(stock => stock.id === entry.stockId)?.name}</td>
                <td>{entry.returnPercent > 0 ? '+' : ''}{entry.returnPercent}%</td><td>{entry.comment || '—'}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </> : null}
      </div> : null}
      {status ? <p role="status">{status}</p> : null}
    </div>
  </div>;
}
