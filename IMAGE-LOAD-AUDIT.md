# 画像読込経路の監査

## 診断版の実機成功と正式フロー（2026-10-04）

利用者がiPhone Safari実機で診断版の写真表示成功を確認しました。スクリーンショットでは写真が表示され、`render complete (pipeline)`、emptyのdisplay:none、previewのdisplay:block、toolbar enabledを確認できます。

正式フローは **File → Object URL → HTMLImageElement → img.onload → source state更新 → preview canvas設定・初回drawImage → effect render → render complete → empty非表示 → 操作可能なpreview表示** とします。decodeやcreateImageBitmapは初回表示の必須条件にしません。成功したObject URLは初回描画後もsourceとともに保持し、次の選択で解放します。Object URLのロード失敗時だけ既存のFileReader fallbackを使います。今回、この成功済みのloader/app/renderer経路を変更していません。

| 状態 | 確認できた事実 |
| --- | --- |
| 旧正常状態 | 旧ホイールUIでiPhone表示が成功していたとの利用者報告。旧loaderはdecode必須。 |
| 不具合状態 | 直接操作UIへの変更後に画像未表示との利用者報告。その時点のonload/decode/Canvas実機ログはなく、停止箇所は不明。 |
| 診断版 | onload優先、初回Canvas設定・raw draw、effect完了待ち、empty非表示の順序を導入。画面診断を追加。 |
| 実機成功 | 上記の診断版で写真と完了ログを利用者が確認。現在の経路全体が成立することが確定。 |

### A/B/Cの切り分けと確定範囲

- **A：decode待ちの除去。** 局所比較テストでdecodeを意図的にrejectさせると旧loaderは失敗し、現在のloaderは成功します。実際の写真選択UIでもdecode失敗・createImageBitmap利用不可の条件下でJPEG/PNG/WebPが表示されます。decodeへの依存がなくなったことは確定。ただし不具合時のiPhoneでdecodeが失敗・停止していた証拠はないため、実機の根本原因とは断定しません。
- **B：emptyをrender完了後に隠す。** 成功時にemptyが確実に非表示となることは実機・自動テストで確認。旧直接操作UIは描画前にemptyを隠していたので、順序変更だけでは以前の未表示原因を説明できません。以前emptyが残っていたという証拠もありません。
- **C：app/rendererの初回設定。** Canvasサイズ・Fit配置・raw draw・effect完了確認・displayReadyによる操作開始制御を明示した経路で成功。個別の寄与は未確定。実機成功版をrevertして比較していません。

**結果の復旧は実機で確認済み、歴史的な根本原因の単独特定は未完了**です。根拠のない追加修正は行いません。モジュール初期化を監査した結果、gestureは画像未登録/displayReady=falseでイベント処理を開始せず、lens/cropは初回null状態では呼ばれません。rendererもsourceと寸法がない場合は処理しません。新たなguardや機能変更は追加していません。

DEBUGは `?debug=1` の場合だけ表示・記録します。通常URLではパネルを非表示とし、診断用イベント監視も登録しません。初期HTMLにもhiddenを指定して表示のちらつきを防ぎます。再診断時は同じURLへ `?debug=1` を付けて開き直します。

## 確認状況

旧UIでiPhoneの画像表示が成功していたという利用者報告を基準とします。このフォルダーにはGit履歴がありません。旧実装の比較元は、この会話に残る変更前のコードです。完全な旧版の実機再検証ではありません。

**iPhoneの根本原因は未確定です。** 再選択が可能でエラーが見えないという報告だけでは、change未発火・ロード停止・描画失敗・表示領域の問題を区別できません。以下の監査結果を根拠にSafari固有の原因を断定していません。

## 実際の現在の経路

1. `index.html` の `.open-photo` または `#empty` のlabel（for="photo"）から、単一の `input#photo[type=file][accept="image/*"]` を開く。
2. `js/app.js` の `$('photo').addEventListener('change', async event => ...)` が `event.target.files[0]` を取得する。
3. `js/image-loader.js` の `loadImage(file, debug)` でImageをロードする。
4. app.jsが `image=next` を登録し、`gestures.reset(index)`、crop/draft/transitionの初期化、`resetView()`を実行する。
5. `Renderer.initializePreview(image, debug)` がCanvasの最大辺800pxのサイズを決定し、onDraw→`layout()`でFitサイズを設定、最初のdrawImageを実行する。
6. `Renderer.schedule(..., {onComplete: resolve})` → requestAnimationFrame → `effects.js` の `processFrame()` → Canvasへ描画 → onDraw→layout。
7. 完了後に `#empty.hidden=true`、display:noneの検証、displayReady=true、ツールバー有効化を行う。

## 旧UIから直接操作UIへの差分

| ファイル | 確認した差分と初期読込への関係 |
| --- | --- |
| index.html | photo/previewのIDは維持。stage/ photo-view wrapperとID付きemptyを追加。ホイールDOMを削除。現DOMの重複ID・旧ホイール参照はテストで検出されない。 |
| app.js | sourceをロードして状態へ登録する経路を維持。Fit・zoom/pan・crop・gesture状態の初期化を追加。旧版にあった無作用のunused取得は診断時に削除したが、旧コードはnullを参照しておらず原因とは扱わない。 |
| image-loader.js | **直接操作UIへの変更時には変更なし。** Object URL→new Image→img.decode()、次の画像選択時にreleaseする旧方式だった。onload優先と失敗時のみFileReaderを使う現在の方式は、その後の明示的なデバッグ依頼に対応した変更。UI改修による差分と混同しない。 |
| renderer.js | 最大辺1000→800、crop・レンズ描画、onDrawによるwrapperのFit配置を追加。初期crop/transitionはnullで、通常のprocessFrame→drawImageへ進む。zoom/panはCSS表示専用。 |
| effects.js | B&W用変換を追加。旧7プリセットの初期画像処理を置き換えていない。 |
| style.css | 直接Canvas表示から中央配置wrapperとtransformによるFit表示へ変更。現在の実UIテストではCanvasの表示寸法が正、display:block・visibility:visible・opacity:1、emptyはdisplay:none。iPhoneの値はdebugで確認が必要。 |
| photo-gestures.js | stageにPointer Eventsを登録。画像未読込ではenabledがfalseとなり、preventDefaultとpointer captureに到達しない。通常の写真選択ラベルはツールバー内。広範囲のtouchイベント抑止はない。 |
| lens.js / crop.js | import時の画像参照はない。初期transition/cropがnullのため、初回描画でレンズ・クロップ処理は実行しない。 |

旧版の読込は `loadImage`→source登録→Canvas表示/empty非表示→`Renderer.schedule`→processFrame→drawImageでした。診断版では描画成功を確認してからemptyを隠す順番に変更しています。

## 実機での切り分け

DEBUGパネルの初期状態はidle。成功時の主な順序は以下です（寸法・スタイル等の情報行も間に入ります）。

```text
input change
file received
objectURL created
image load start
image.onload
natural size取得
source image registered
zoom/pan/crop initialized
preview canvas resize
drawImage start
drawImage success
effect render start
render complete
empty state hidden
toolbar enabled
render complete (pipeline)
```

失敗時はERROR:処理名と例外メッセージを表示します。ファイル名・type・size、FileList件数、natural/backing/client寸法、devicePixelRatio、Canvas/wrapper/emptyの表示スタイルも画面上だけで確認できます。情報は保存・送信しません。

`tests/image-loader-only.html` は同じlabel/file inputから、会話中の旧decode方式と現在のloaderを切り替えてCanvasに描画する切り分け専用ページです。加工・gesture・Fit wrapperを含まず、アプリを置き換えません。同じiPhone・同じ写真で比較してください。

## 回帰テスト

`tests/image-loading.cjs` は実際の「写真を選ぶ」labelをタップし、filechooserへJPEG/PNG/WebPを渡します。change→loader→rendererのログ順、Canvasの非透明画素、表示寸法、empty消滅、ツールバー有効化、DOM一意性を検証します。rendererへの直接画像注入は行いません。旧/現在loader単独比較も行います。

Edgeのタッチ端末エミュレーションで上記テストと `tests/browser.cjs` の既存機能テストが成功しました。iPhone Safariでの成功や根本原因の確定を意味しません。実機の最後のDEBUG行を取得してから、問題の分岐に限定した修正を行います。

## 実機UIの追加修正（2026-10-04）

emptyはstageの横flex内でphoto-viewと並ぶ通常フローの子だった。初期layout()は仮のviewSize=1×1からwrapperのFitサイズを設定するため、写真がなくてもwrapperが横幅を占有し、emptyが残り幅に縮む構造だった。stage基準のabsolute inset:0オーバーレイへ変更し、文字だけの固定幅ではなくflex競合を解消した。100vw、aspect-ratio、emptyへのzoom継承はなかった。390×844のcomputed layoutはstage 390×684、wrapper 390×390、empty 390×684、empty左端0・右端390、transform/translateなし。横overflowなし・横書き・stage中央を検証した。

角度input→draft.angle更新→constrainCrop→render→cropFrameの経路で、constrainCropが回転後の四隅範囲からcx/cyをclampしていた。局所再現では400×600画像、200×300枠、cx=100、cy=300で0→5°によりcx=112.69へ移動した。角度専用setCropAngleは同じcx/cyを保持し、その点から画像各端までの距離を使って最小cover scaleだけ増やす。cropFrameは従来どおり枠中心translate→rotate→scale→source中心translateで描画する。zoom/pan、crop幅高さ、Fitをリセットしない。角度を戻す際も既存scaleを維持し、不意のズーム縮小を行わない。

crop-panelはstageの外にあり、range操作のイベントはstageへbubbleしない。さらにgesture開始時にinput/button/select/label/a/dialogを除外した。通常URLのDEBUG非表示も既存回帰テストで維持。

tests/layout-angle.cjsで指定角度列のsource中心移動0、表示中心移動1px未満、スライダータップのstage pointerdownなしを検証。旧制約による中心移動も局所比較で再現。画像読込テストと既存機能テストも成功。スクリーンショットui-empty.png/ui-angle-0.png/ui-angle-5.png/ui-angle--5.pngはEdgeの390×844タッチ端末エミュレーションであり、修正後のiPhone実機確認は別途必要。

## 調整シートと連続角度入力（2026-10-04）

調整シートのみ高さ32dvh（fallback 32svh）、最大35dvhに固定。safe-area分のpaddingを高さ内に含み、ヘッダーは固定、min-height:0の内部一覧だけスクロール。書き出しシートは変更しない。

連続角度inputの追跡では、crop中心・pan・zoom・枠寸法は角度計算から変更されず、scaleはMath.maxで非減少だった。往復する数値は再現できていない。一方rendererは毎描画で同じCanvas width/heightを代入（Canvas内容とコンテキストをリセット）し、onDrawで同じFit/transformを再適用していた。不要な同寸法リセットを停止し、角度操作中の同寸法Fit再適用も停止。input値はrAFで集約し、操作開始時のcrop中心/pan/zoomを固定する。操作中のgesture開始は無効化し、開始前に既存pointer/motion状態を解除する。change/pointerup/cancel/blurで最終値を適用してロック解除。minScaleを診断へ明示し、既存の非減少scale計算を維持した。

continuous-angle.cjsで連続input列と同一フレーム内10入力を検証。中心/pan/zoomは固定、scaleは非減少、描画集約、固定シート内部スクロールを確認。既存crop/exportテストも成功。Safari実機の激しい揺れ自体と、その単独原因は未確定。数値が振動していたと断定しない。?debug=1でangle/pan/zoom/minScale/effectiveScale/cropCenterを確認できる。最新版URLは?v=20261004-3。

## 角度の追加計測と調整保持（2026-10-04）

暗転は共通.sheet::backdropの#0005によるもので、調整シートのみtransparentへ上書きした。写真Canvasへのbrightness/filter/opacity変更はない。

角度再調査では実描画後のANGLE FRAMEを追加。Edgeの連続input試験で変化したのはangle/minScale/effectiveScaleおよび回数のみ。pan/zoom/crop中心・rect、Canvas属性とCSS寸法、wrapper rect/transform/origin、display/draw座標、scroll/visualViewportは固定だった。scaleは非減少。単一のpreview Canvasを使い、crop用一時CanvasはDOMに追加しない。レンダーはapp→Renderer.scheduleのrAF集約経路のみ。現時点でiPhoneの激しい振動の根本原因は未確定であり、この再調査では角度補正値や描画方式を追加変更していない。実機のANGLE FRAMEが必要。

調整値をAdjustmentStoreへ分離。presetsのnameを安定キーとしてoverridesと3つのfavoritesをlocalStorage retroFilm.adjustments.v1へ保存。起動時に範囲・数値・monochrome・preset・strengthを検証。デフォルトは変更しない。お気に入り保存は専用ボタン、呼出時はpreset/strength/値を一括復元。

release後targetはround(position)を基準に±1以内。高速時はvelocity方向の隣接整数（正ならfloor+1、負ならceil-1）、低速時はroundへ200msの既存snap。drag中の複数移動と巨大レンズは維持。旧無制限慣性の呼出を止めた。

adjustment-memory、continuous-angle、browser、image-loading、service-workerテストで検証。iPhoneでは透明backdrop、再起動後の保持、favorites呼出、release制限、およびANGLE FRAMEの固定/変動値を再確認する。
