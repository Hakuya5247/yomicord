export type Logger = {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

// なぜ: Discord のイベント結線と「ready 時にやる処理」を分離し、テスト可能な形にする。
export function createReadyHandler(args: { logger: Logger }) {
  return async function runApiCallsOnReady() {
    // 注意: ready 時の初期化はベストエフォート（失敗しても Bot 自体は起動継続）。
    // TODO(P1): Ready のたびに初期化 API を叩かないよう、冪等化（1回のみ/差分時のみ）を入れる。
    // TODO(P1): API 呼び出しにタイムアウト/少数回リトライを導入し、起動時の不安定さに耐える。

    args.logger.log('API 呼び出しが完了しました');
  };
}

// なぜ: Discord の ready イベント入口を薄く保ち、ログ出力と実処理を分離する。
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
