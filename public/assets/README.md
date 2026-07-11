# 可替換素材目錄

目前角色、障礙物、道具、三關場景與視覺特效皆為原創 code-native vector art，
由 Phaser 在執行時繪製；音效與三階段配樂則由 Web Audio API 即時合成。
因此此目錄目前不含圖片、音訊、字型或其他第三方素材。

未來替換 sprite sheet、音效或其他自製／已授權素材時，可放在此目錄，並保留：

- 角色狀態：`idle`、`running`、`jumping`、`hurt`、`finished`、`gameOver`
- 障礙物類型：`illness`、`sportsInjury`、`overtraining`
- 訓練／恢復道具類型：`sleep`、`strength`、`nutrition`、`zone2`、`lsd`、`interval`
- 關卡場景：`base`、`build`、`race`（基礎期、進階期、正式比賽）

加入任何檔案前，請一併記錄來源與授權。
