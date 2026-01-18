/**
 * Bot 内部で使用する最小限のロガー契約。
 */
export type Logger = {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

/**
 * Discord のイベント結線と「ready 時にやる処理」を分離し、テスト可能な形にする。
 * @param args.logger - 失敗時にも起動継続できるよう、ここでログのみ責務を持つ。
 * @returns ready 時の初期化処理。
 */
export function createReadyHandler(args: { logger: Logger }) {
  return async function runApiCallsOnReady() {
    // 注意: ready 時の初期化はベストエフォート（失敗しても Bot 自体は起動継続）。
    // TODO(P1): Ready のたびに初期化 API を叩かないよう、冪等化（1回のみ/差分時のみ）を入れる。
    // TODO(P1): API 呼び出しにタイムアウト/少数回リトライを導入し、起動時の不安定さに耐える。

    args.logger.log('API 呼び出しが完了しました');
  };
}

/**
 * Discord の ready イベント入口を薄く保ち、ログ出力と実処理を分離する。
 * @param args.logger - ログ出力にのみ使用する。
 * @param args.getClientTag - 監査用途の表示名取得（取得できない場合は unknown を出す）。
 * @param args.onReady - ready 時に実行する処理。
 * @returns Discord.js の ready ハンドラ。
 */
export function createReadyListener(args: {
  logger: Logger;
  getClientTag: () => string | undefined;
  onReady: () => Promise<void>;
}) {
  return async function onClientReady() {
    args.logger.log(`ログインしました: ${args.getClientTag() ?? 'unknown'}`);
    await args.onReady();
  };
}
