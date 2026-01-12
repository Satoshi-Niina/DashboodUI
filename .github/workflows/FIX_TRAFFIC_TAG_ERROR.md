# Cloud Run Traffic Tag Error の修正方法

## エラー内容
```
ERROR: (gcloud.run.deploy) spec.traffic.tag: traffic tag 'sha-99a379e31b3d30528a3b6f2f246962a4013c70ec' and service name 'emergency-server' together are too long. 
Combined traffic tag and service name cannot exceed 46 characters.
```

## 原因
- サービス名: `emergency-server` (16文字)
- トラフィックタグ: `sha-99a379e31b3d30528a3b6f2f246962a4013c70ec` (44文字)
- 合計: 60文字 > 46文字制限 ❌

## 解決策

### 方法1: トラフィックタグを短縮する（推奨）

GitHub Actionsワークフローファイル（`.github/workflows/deploy.yml`）で、トラフィックタグを短いSHAに変更します：

```yaml
- name: Build and Deploy to Cloud Run
  run: |
    # 短いSHA（最初の7文字のみ）を使用
    SHORT_SHA=$(echo "${{ github.sha }}" | cut -c1-7)
    
    gcloud run deploy emergency-server \
      --image=gcr.io/${{ env.PROJECT_ID }}/emergency-server:latest \
      --region=${{ env.REGION }} \
      --platform=managed \
      --allow-unauthenticated \
      --tag="sha-${SHORT_SHA}"  # 短いタグに変更
```

### 方法2: トラフィックタグを完全に削除する

タグ機能が不要な場合は、`--tag` オプションを削除します：

```yaml
- name: Build and Deploy to Cloud Run
  run: |
    gcloud run deploy emergency-server \
      --image=gcr.io/${{ env.PROJECT_ID }}/emergency-server:latest \
      --region=${{ env.REGION }} \
      --platform=managed \
      --allow-unauthenticated
      # --tag オプションを削除
```

### 方法3: サービス名を短縮する

サービス名自体を短くします：

```yaml
env:
  SERVICE_NAME: emg-server  # emergency-server から短縮
```

または

```yaml
env:
  SERVICE_NAME: emer-srv  # さらに短く
```

## 推奨される修正

### emergency-serverリポジトリの `.github/workflows/deploy.yml` を以下のように修正：

```yaml
- name: Build and Deploy to Cloud Run
  run: |
    # 短いコミットSHAを生成（7文字）
    SHORT_SHA="${GITHUB_SHA:0:7}"
    IMAGE_TAG="gcr.io/${{ env.PROJECT_ID }}/emergency-server:${SHORT_SHA}"
    
    # Dockerビルド
    docker build -t $IMAGE_TAG .
    docker push $IMAGE_TAG
    
    # Cloud Runにデプロイ（短いタグを使用）
    gcloud run deploy emergency-server \
      --image=$IMAGE_TAG \
      --region=${{ env.REGION }} \
      --platform=managed \
      --allow-unauthenticated \
      --tag="v-${SHORT_SHA}"
      # タグの長さ: v-1234567 = 9文字
      # サービス名: emergency-server = 16文字
      # 合計: 25文字 < 46文字 ✅
```

## 文字数計算

| サービス名 | タグ | 合計 | 結果 |
|-----------|------|------|------|
| emergency-server (16) | sha-99a379e...c70ec (44) | 60 | ❌ エラー |
| emergency-server (16) | sha-99a379e (11) | 27 | ✅ OK |
| emergency-server (16) | v-99a379e (9) | 25 | ✅ OK |
| emg-server (10) | sha-99a379e (11) | 21 | ✅ OK |

## 適用手順

1. `emergency-server`リポジトリに移動
2. `.github/workflows/deploy.yml`を編集
3. 上記の修正を適用
4. コミット＆プッシュ
5. 再デプロイ

## 確認コマンド

```bash
# 現在のCloud Runサービスのタグを確認
gcloud run services describe emergency-server \
  --region=asia-northeast2 \
  --format="value(status.traffic)"
```
