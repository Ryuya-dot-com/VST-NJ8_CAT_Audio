# confirmation-v1 結果要約

結論: **全ゲートを通過した候補は0件**。この結果を根拠に、本番停止規則や
新得点をUIへ切り替えてはならない。

## 再現情報

- 計画: `confirmation-v1`、seed `20260813`
- 設計: 15 theta条件 × 5,000反復 × 7候補 = 525,000 CAT
- 得点モデル: `paper-3pl-v1`
- エンジン: `cat-eap-3pl-monte-carlo-v1`
- 乱数生成器: `mulberry32-v1`
- 項目バンクSHA-256: `ed058c8b87ef951c70512f89ac2ba708f18db983dd5b449b201e9b2dc97d0d47`
- 計画SHA-256: `1aab9c60dd0c5036342caeec19c0e9f3d2e653d5d494cf73de42ce3bac7af60a`
- 結果SHA-256: `5af908caffebccd9d295133277d95a01a56085a7e9e1c55b0ef0d2ae5c785752`
- 判定結果SHA-256: `d0c20daa6b7a678162e20c11d292695241722ef0b97a0109ef16e49a076d566c`
- Written版とAudio版の結果はバイト単位で一致した。

判定基準は [`../decision-criteria-v1.md`](../decision-criteria-v1.md)、完全な
条件別結果は [`confirmation-v1.json`](confirmation-v1.json)、機械判定は
[`confirmation-v1-evaluation.json`](confirmation-v1-evaluation.json) を正本とする。

## 候補別の最悪条件と判定

すべての最大bias、最大RMSE、最小被覆率は `theta = -3.5` で生じた。

| 候補 | 平均長 | 最大絶対bias | 最大RMSE | 最小95%被覆率 | 最大露出 | 不合格ゲート |
|---|---:|---:|---:|---:|---:|---|
| SE .40 / min20 / MFI | 20.04 | .392 | .478 | .822 | .583 | bias, RMSE, coverage, exposure |
| SE .30 / min20 / rand5 | 20.93 | .390 | .478 | .802 | .356 | bias, RMSE, coverage, burden, exposure |
| SE .30 / min20 / rand10 | 21.09 | .420 | .504 | .786 | .295 | bias, RMSE, coverage, burden, exposure |
| SE .30 / min20 / rand20 | 21.47 | .495 | .568 | .727 | .255 | bias, RMSE, coverage, burden, exposure |
| fixed20 / rand5 | 20.00 | .423 | .499 | .810 | .356 | bias, RMSE, coverage, exposure |
| fixed20 / rand20 | 20.00 | .572 | .629 | .752 | .241 | bias, RMSE, coverage |
| fixed30 / rand5 | 30.00 | .363 | .436 | .842 | .381 | bias, RMSE, coverage, burden, exposure |

全候補で、項目バンク枯渇率とレベル7以上を2問含める制約の違反率は0だった。

## 査読上の解釈

1. `SE <= .40` は実質的に20問固定に近い。全体の99.68%がprecision停止し、
   平均長は20.04問である。このデータでは閾値`.40`の一般的引用だけでは停止規則を
   正当化できない。
2. randomesqueを5から20へ広げると、fixed20の最大露出は`.356`から`.241`へ
   下がる一方、theta `-3.5` の絶対biasは`.423`から`.572`へ悪化した。単純な
   randomesque拡大だけでは、bank securityと端点精度を同時に満たさない。
3. fixed30/rand5は検討候補中で端点誤差が最小だったが、それでもtheta `-3.5` の
   biasは`.363`、被覆率は`.842`である。さらに平均30問と最大露出`.381`により
   burden・exposureゲートも不合格である。
4. theta `2` でも現行型MFIの95%被覆率は`.9096`で、Monte Carlo誤差を考慮しても
   事前基準を満たさない。問題は極端な1点だけに限定されない。
5. これはモデルが正しく、項目パラメータも既知という有利な条件での失敗である。
   実データ妥当性、校正誤差、DIF、局所依存を加える前に不合格なので、現時点で
   生産運用を支持する証拠はない。

## 次の設計変更

- theta端点におけるtest informationと項目パラメータ分布を診断する。
- EAP事前分布、WLE等の端点bias対策を、事前に固定した感度分析で比較する。
- frequency levelと品詞のblueprintを含むshadow testingまたは同等の制約付き選択を
  実装する。
- 単純randomesqueではなく、最大露出を直接制御する方式を比較する。
- 語彙数区間幅による停止と、30問を超える最大長の便益・負担を評価する。
- 筆記版160問実データのpost-hoc CATを行う。Audio版は独立校正またはモードリンクが
  得られるまで筆記版パラメータを正式得点として扱わない。

探索後にゲートを緩めて同じ結果を合格扱いしない。変更が必要なら新しい計画IDとseedで
別の確認試験を行う。
