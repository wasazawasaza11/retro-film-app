# 動画対応 Phase 1・2（2026-10-18）

実装範囲は動画選択・再生と加工プレビューまで。Phase 3以降の動画書き出し、MP4 mux、音声付き出力、時間変化エフェクトは未実装です。GitHubへのpush・デプロイは実施していません。

## 構造

- `input#photo` は `image/*,video/*`。File.typeがvideoなら動画へ分岐。写真のObject URL→Image.onload経路は変更していません。
- `video-source.js` の `loadVideo()`：File→Object URL→HTMLVideoElement→loadedmetadata（ここで初めて寸法・長さ検証）→canplay。playsinline、ユーザーの再生タップを使用。正常ロード後もObject URLを保持。失敗時はelementとURLを解放。
- appの `media={type,photo,photoCrop,video,playback}` が写真／動画を別所有。既存の `image` 変数はRendererへ渡すdrawable adapter。動画のadapterもsource/width/height/seedを持つ。再生位置・長さは動画sourceで管理。写真のcropはvideoのrenderに渡さず、写真source/cropを保持。新しい写真を選ぶ時のFit・crop初期化は従来どおり。
- 共通のpreset/strength/parameters/AdjustmentStoreを使用。詳細値・お気に入り・B&Wを共有。動画全体を加工し、動画モードのみcrop/exportアイコンを無効化。
- `VideoPlayback` はrequestVideoFrameCallbackをfeature detectionし、非対応時だけrequestAnimationFrame。rAF時は同じcurrentTimeの再処理を抑える。setIntervalなし。pause/endedでcallbackを停止、seekedで停止中も再描画。visibilitychange/pagehideで一時停止。
- video→既存Renderer→同じprocessFrame→Canvas。写真のエフェクト処理は複製・変更していません。写真プレビュー最大辺800、動画は負荷を抑えるため640。再生性能・fpsは端末とエフェクト強度に依存し、30fps維持を保証しません。
- 巨大レンズの外側フレームも、動画ではフレームごとに生成し、前フレームの静止したキャッシュを使わない。プリセット補間・スワイプ・プレビュー専用ピンチは共通経路。
- 不要になったcallback/イベント/element/Object URLを解放。全フレームのArray蓄積なし。一時CanvasはRendererのfinallyで解放。選択した動画はFileセッション内のみで、Storage/SW/外部サーバーへ保存しない。

requestVideoFrameCallbackは描画フレームに対応するAPIで、非対応時のfallbackが必要です。[MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)

## UIと制限

動画時だけ、写真領域下端に小さな再生/一時停止・シーク・現在位置/長さを表示。動画は自動再生せず、再生タップで開始。source動画の音声をmutedにしていませんが、OSの音量・出力先に依存します。動画音声の書き出しは未実装です。

推奨は1080p以下、30fps程度、60秒以内。解像度/長さが推奨を超える場合は警告し、ハード制限はしません。fpsを正確に推定する仕組みは未追加。MP4/MOVはコンテナ名だけで再生可否が決まらず、HEVC/HDRを含め端末デコーダー依存です。ブラウザで解読できない場合はエラーを表示し、既存sourceを維持します。

粒子・傷などはPhase 2では固定seedの静止画パイプラインをそのまま使用。時間変化はPhase 5まで実装しません。

## テスト

Phase 1を先に `tests/video-source.cjs` で検証後、Phase 2の接続を実装。

| テスト | 確認内容 |
| --- | --- |
| video-source.cjs | ローカル生成H.264 MP4・QuickTimeブランドMOV、metadata/canplay、寸法/長さ、play/pause/seek、callback/element解放 |
| video.cjs | 実picker経路、MP4/MOV Canvas表示、再生中の詳細値/強度/お気に入り/B&W、レンズ/スワイプ/ピンチ、停止/シーク、破損動画拒否、写真復帰、RVFCとrAF fallback |
| image-loading.cjs | 実picker JPEG/PNG/WebP、onload初回描画、empty非表示、decode非依存 |
| browser.cjs | 写真の全プリセット/補間、レンズ/ピンチ、詳細値、crop/角度/90°、JPEG/PNG生成・共有境界・download、オフライン |
| adjustment-memory.cjs | プリセット別保持・localStorage・3枠お気に入り・release制限 |
| continuous-angle.cjs / layout-angle.cjs | 写真crop中心固定・連続input・empty・シート内部スクロール |
| service-worker.cjs / pages.cjs | 旧cache更新、19アセット、relative scope、サブパス、オフライン写真と動画読込、動画非キャッシュ |

Edgeの390×844タッチエミュレーションで確認。合成動画は160×240・約2.2秒・H.264で、MOVは同じISO-BMFFデータをQuickTimeブランドにしたfixtureです。iPhone撮影の本物のMOV/HEVC/HDRをテスト済みとは扱いません。テストはローカル生成し、画像・動画・ファイル名のアップロードは行いません。

`video-source.cjs` がfixtures/video.mp4とvideo.movを再生成します。ほかのテストと同時実行せず先に実行してください。ブラウザの負荷によるタイムアウトを避けるため、回帰テストも順番に実行します。

## iPhone Safari / ホーム画面PWAで確認すること

1. HTTPSの最新版でJPEG/PNG/WebPを選び、従来の写真機能と共有保存が使えること。
2. iPhone撮影MP4/MOV（H.264/HEVC、縦向き、音声あり）を選び、向き・寸法・長さ・初回Canvas・エラー表示を確認。HDRの色は端末Canvasの色変換に依存。
3. 再生タップでフルスクリーンへ移らず再生し、音声、pause、終了、停止中/再生中のシークを確認。
4. 再生中の上下スワイプ・レンズ・B&W・11調整・強度・お気に入り・2本指ピンチで映像が途切れないか確認。ピンチや再生コントロールで誤ったプリセット変更がないこと。
5. 長い動画、連続選択、破損動画、動画→写真、バックグラウンド/復帰時の停止と再生再開を確認。
6. ホーム画面standaloneとSafari両方でSafe Area、写真領域、コントロールの操作性・処理速度・熱/メモリを確認。
7. 初回オンラインキャッシュ後に機内モードで起動し、端末内の動画を選び再生/加工する。iCloudだけにある未ダウンロード動画のオフライン取得はアプリでは保証できない。

実機成功を確認するまではPhase 3/4へ進めません。動画保存・共有はまだ操作できず、写真のJPEG/PNG保存と共有は従来どおりです。

## プリセット名と動画コントロールの重なり修正

両方がstage下端基準で、toast bottom:26pxとcontrols bottom:8pxの表示領域が重なっていた。動画モードだけcontrolsの実測高さをResizeObserverでCSS変数へ渡し、toast下端をcontrols上端から24px上へ配置。stageは既存mainのSafe Area内にあり、その配置を維持。toast z-index:3、controls:4、ボトムシートはdialogのtop layer。写真のbottom:26px・1100ms後のフェード・pointer-events:noneは維持した。

tests/video-toast.cjsで縦横動画とも余白24px、再生/停止/シーク、フェード、写真位置を検証。video/image-loading/pagesの既存試験も成功。tests/video-toast.pngは390×844のEdgeタッチエミュレーションで、実機キャプチャではない。CSSとappエントリーURLの版を20261018-2、Worker cacheをv10へ更新。加工・再生・gestureロジック変更なし。

## 実矩形に基づくtoast安全領域（2026-10-19）

前回はcontrols高さとCSS bottom:8pxからtoast bottomを逆算していた。iPhoneでは重複が残ったという実機報告があり、実機の座標ログはないためSafari側の単独原因は断定しない。今回はtoastとcontrols双方のgetBoundingClientRectを使う方式に置き換えた。

targetBottom=min(controlsRect.top-40,表示映像下端-32)とし、toastのoffsetHeightを差し引いてstage内top座標へ変換。設定後に実際のtoastRect.bottomも取得して差分補正する。親座標のscale・borderも考慮する。controlsが未表示/ゼロ寸法なら映像の見える下端から100px上をfallback下端とする。表示中とフェード中だけrAFで再確認する。写真時はtop指定を除き、従来bottom:26pxを維持。動画/写真の描画・再生・フィルター・gestureコードは変更しない。

390×844・約12秒の合成縦横動画でplay/pause/seek/シークpointer保持を検証。縦はgap40px、横は映像内配置を優先してgap218.3125px。controlsを移動/拡大する局所試験でも16px以上を維持。スクリーンショットtests/video-toast.pngはEdgeのエミュレーション。実機確認は未実施。配信入口/CSSは20261019-1、Worker cacheはv11へ更新。
