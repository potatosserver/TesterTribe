rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(authorUid) {
      return isSignedIn() && request.auth.uid == authorUid;
    }

    function getApp(appId) {
      return get(/databases/$(database)/documents/apps/$(appId)).data;
    }

    // ✅ 新增：Users 集合權限
    match /users/{userId} {
      allow read: if isSignedIn();  // 登入用戶可讀取所有用戶基本資料（用於開發者主頁）
      allow create: if isSignedIn() && request.auth.uid == userId;
      allow update: if isSignedIn() && request.auth.uid == userId;
      allow delete: if false;
    }

    match /apps/{appId} {
      allow read: if true;
      
      allow create: if isSignedIn() 
        && request.resource.data.authorUid == request.auth.uid;
        
      allow update: if isOwner(resource.data.authorUid) 
        || (isSignedIn() && request.resource.data.authorUid == resource.data.authorUid);
        
      allow delete: if isOwner(resource.data.authorUid);

      match /likes/{userId} {
        allow read: if true;
        allow write: if isSignedIn() 
          && request.auth.uid == userId 
          && getApp(appId).authorUid != request.auth.uid;
      }

      match /testers/{userId} {
        allow read: if true;
        allow write: if isSignedIn() && request.auth.uid == userId;
      }

      match /ratings/{userId} {
        allow read: if true;
        allow write: if isSignedIn() 
          && request.auth.uid == userId 
          && getApp(appId).authorUid != request.auth.uid
          && request.resource.data.score >= 1 
          && request.resource.data.score <= 5;
      }

      match /feedbacks/{userId} {
        allow read: if true;
        
        allow create: if isSignedIn() 
          && request.auth.uid == userId
          && (request.resource.data.type != 'review' || getApp(appId).authorUid != request.auth.uid);

        allow update: if isSignedIn() && (
          (request.auth.uid == userId && (request.resource.data.type != 'review' || getApp(appId).authorUid != request.auth.uid))
          || getApp(appId).authorUid == request.auth.uid
        );

        allow delete: if isSignedIn() 
          && (request.auth.uid == userId || getApp(appId).authorUid == request.auth.uid);
      }
    }
  }
}