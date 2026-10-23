# 動画書き出し Phase 3・4（ローカル実装）

2026-10-19。GitHubへのpushは実施していません。PCでの実装・検証と、iPhoneの実機完了条件は分けて扱います。

## 採用方式と対象

File（BlobSource）→Mediabunnyのdemux/VideoDecoder→共通processFrame→VideoEncoder H.264→MP4 mux。Canvasのプレビュー画面録画やMediaRecorderは採用していません。最大辺640pxのプレビューとは別のCanvasを出力サイズで作り、同じパラメータとseedを適用します。

Mediabunny 1.61.6を未変更でローカル同梱しました。標準WebCodecsには入力コンテナ解析・音声パケットコピー・MP4 muxがないため導入しています。MPL-2.0のLICENSEと対応ソースの上流配布archiveを同梱しています。[配布情報](vendor/mediabunny/NOTICE.md)

主な新規コード：video-capabilities.js、video-export.js、video-export-ui.js。写真exporter/image-loader/crop/effectsの処理は変更していません。appは動画用アイコンの有効化と専用シート接続、video-sourceは選択Fileのページセッション内保持のみ追加。

## 実測capability report

書き出しシートを開くとAPI有無と対象ファイル/解像度のH.264設定を確認します。?debug=1の時だけ能力レポートを表示・画面ログへ記録します。通常UIに開発レポートは出しません。

| PC Edgeの実測 | 結果 |
| --- | --- |
| VideoEncoder / VideoDecoder | 利用可能 |
| 対象H.264 encoder config | supported:true |
| AudioEncoder / AudioDecoder | 利用可能 |
| AAC 48kHz stereo / 128kbps config | supported:true |
| MediaRecorder | 利用可能 |
| MP4 H.264/AAC・MP4・WebM候補 | isTypeSupported:true |
| canvas.captureStream | 利用可能 |
| MediaStreamTrackProcessor / Generator | 利用可能 |
| requestVideoFrameCallback | 利用可能 |

この表はiPhoneの対応を示すものではありません。iPhone Safariとホーム画面PWAではそれぞれ実際のreportを確認してください。APIが存在しても設定や入力コーデックが非対応なら処理を止め、音声を落としたファイルやWebMを勝手に生成しません。

H.264/入力decodeが不足する場合、MediaRecorder+export Canvas+Web Audio経由のMP4録画は代替候補ですが、実時間処理・ドロップフレーム・音声同期・バックグラウンド停止の制約があります。WebCodecsのソフトウェア代替には別のローカルWASM codecが必要となり、容量・負荷・ライセンス確認が増えます。今回の失敗時に自動で別方式へ移行する処理は入れていません。実機reportを根拠に次の方式を決めます。

## 解像度・fps・画質

- 元解像度 / 1080pまで / 720pまで。縦動画は長辺1920または1280で縮小し、小さい入力は拡大しません。
- H.264のため幅・高さを偶数へ切り下げます。奇数画素入力では最大1px縮小します。
- packet metadataから元fpsを推定し、最大60、判定できない場合30fps。VFRは推定fpsで出力へ正規化します。
- 高 / 標準。UIへ細かいbitrate設定は追加していません。
- 入力の向き/flipを変換段階で画素へ反映し、出力には重複した回転metadataを付けません。
- 4K/60秒超は警告。ブラウザのencoder・Canvas・メモリ上限により失敗することがあります。まず1080p・30fps・10〜15秒を実機確認してください。

## 音声・同期

主要1映像・主要1音声を対象とします。元AACは可能ならパケットをコピーしてmuxし、それ以外はdecode→AAC encode。元動画に音声がなければ無音トラックを新設せず映像だけを出力します。変換前にdiscardedTracksを検査し、主要映像または音声を失う変換は中止します。

元のtimestamp/durationは変換エンジンが扱い、audio/videoの同期を保ちます。テストではAACの最初の圧縮パケットの完全一致、出力音声のdecode後RMS、出力durationを確認しています。実機の口の動き・環境音との同期は別途必要です。

## メモリ・進捗・キャンセル

フレームはdecoder→共有effect→encoderへ逐次処理。全VideoFrameの配列保持なし。ライブラリがencoder backpressureを処理し、samples/framesをcloseします。アプリのscratch Canvasとeffect Canvasも次フレーム/終了時に解放します。

最終的な圧縮済みMP4はBufferTargetからFileへ渡すためメモリに保持します。全フレームの常駐ではありませんが、圧縮ファイルサイズに応じたメモリは必要です。4K長尺でメモリ一定を保証するものではありません。

progressは変換エンジンのtimestamp進捗から算出し、%と処理済み時間を表示。mux完了までは99%以下とし、executeの完了と非空出力を確認して100%にします。キャンセルはAbortController→conversion.cancel→decoder/encoder・Canvas・Input・出力bufferの解放へ進みます。シートを閉じ、ロックを解除し、再書き出し可能に戻します。処理中は差替え/調整/gesture/再生/シークをロックし、キャンセルだけを許可します。

## エフェクトと再現性

現在のPhase 1/2プレビューは固定seedです。書き出しもそのseedと同じprocessFrameを使用し、Math.randomや処理速度を使いません。grain/dust/scratches/lightLeak/RGB shift/B&Wは同じ設定・同じseedなら同じ時間tで再現します（現在の時間関数は固定状態）。Phase 5の時間変化を新規導入していません。解像度差・H.264の圧縮・色管理により完全なピクセル一致にはなりません。

## 保存・共有

`originalname_retro.mp4` / `video/mp4` のFileを生成。生成後の「共有して保存」タップ内でcanShare({files})→share({files})を直ちに実行します。長いencode後にユーザー操作権限が失われるため、生成後の保存タップが必要です。共有非対応/実失敗はdownloadへ、AbortErrorではdownloadしません。写真の既存共有は変更していません。

## 検証と実機完了条件

自動試験：6秒の音声あり/なし、H.264/AAC MP4、AACパケットコピー、Opus→AAC、B&W/VHS/調整、90°rotationを画素へ反映、進捗、cancel/retry、codec close、実UIロックと共有/共有キャンセル/download fallback。実際の1080×1920入力から1080p/720pのMP4生成と再decodeも検証（合成6秒・5fps）。同時刻の共通processFrameと出力の色差、元/出力audio-video開始timestamp、出力durationも確認。

既存静止画の画像読込・全加工・ピンチ/レンズ・crop/角度/90°・詳細値保持/お気に入り・JPEG/PNG・共有・PWAテストを維持します。Pages試験では相対パス/23アセット、オフラインlibrary読込とMP4生成も確認します。

**iPhone Safari/PWAのPhase 3・4完了条件はまだ未確認です。** まず音声あり・縦1080p・30fps・10〜15秒で以下を確認してください。

1. ?debug=1で動画を開き、書き出し能力レポートのH.264/AACと入力codecを確認。
2. 元/1080p/720p、高/標準で生成し、progress・キャンセル・再試行を確認。
3. 「共有して保存」→標準共有シート→「ビデオを保存」→写真アプリで再生。
4. 向き・音声・口/音の同期・長さ・色を元プレビューと比較。
5. 共有キャンセルがdownloadしないこと。Safariとstandaloneそれぞれで確認。
6. オンラインで新Workerの準備後、機内モードで起動し、端末内動画のMP4生成を確認。

HEVC/MOV・HDRの入力decode/色変換はWebCodecsとOSに依存します。プレビューが再生できてもWebCodecs decodeが非対応なことがあります。その場合はreportを提示して中止します。実機の保存完了をPC試験で代替しません。
