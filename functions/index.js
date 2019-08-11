const functions = require('firebase-functions');
const express = require('express');
const { getAllBlogs, addOneBlog , getOneBlog, commentOnBlog, likeOnBlog , unlikeOnBlog, deleteBlog, getComments} = require('./handlers/blogs');
const { signup, login, uploadImage, addUserDetails, getAuthenticatedUser, getUserDetails, markNotificationsRead, loginUsingGoogle} = require('./handlers/users');
const FBAuth = require('./util/FBAuth');
const {db} = require('./util/admin')
const app = express();


//display all blogs
app.get('/blogs', getAllBlogs );
//add a new blog
app.post('/add', FBAuth, addOneBlog );
//get a particular  blog
app.get('/blog/:id', getOneBlog);
//delete a blog
app.post('/blog/:blogId/like',FBAuth, likeOnBlog);
app.post('/blog/:blogId/unlike',FBAuth, unlikeOnBlog);
//comment on a blog
app.post('/blog/:blogId/comment',FBAuth, commentOnBlog);
app.get('/blog/:id/comments',FBAuth, getComments);
app.delete('/blog/:blogId/delete',FBAuth, deleteBlog);


//sign u
app.post('/signup', signup);
//login
app.post('/login', login );
// app.post('/signin', loginUsingGoogle);

//upload image
app.post('/user/image', FBAuth, uploadImage);

app.post('/user', FBAuth,  addUserDetails);

app.get('/user', FBAuth, getAuthenticatedUser);

app.get('/user/:userHandle', getUserDetails)
app.post('/notification',FBAuth,markNotificationsRead)


exports.api = functions.region('asia-east2').https.onRequest(app);
exports.createNotificationOnLike = functions.region('asia-east2').firestore.document('likes/{id}')
.onCreate(snapshot => {
    return db.doc(`blogs/${snapshot.data().blogId}`).get().then((doc) => {
        if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
            return db.doc(`notifications/${snapshot.id}`).set({
                createdAt: new Date().toISOString(),
                recipient: doc.data().userHandle,
                sender: snapshot.data().userHandle,
                type: 'like',
                read: false,
                blogId: doc.id
            });
        }
    }).catch((err) => console.error(err));
});

exports.deleteNotificationOnUnLike = functions
  .region('asia-east2')
  .firestore.document('likes/{id}')
  .onDelete((snapshot) => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch((err) => {
        console.error(err);
        return;
      }).catch((err) => console.error(err));
  });

exports.createNotificationOnComment = functions
  .region('asia-east2')
  .firestore.document('comments/{id}')
  .onCreate((snapshot) => {
      return db.doc(`blogs/${snapshot.data().blogId}`).get().then((doc) => {
          if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
              return db.doc(`notifications/${snapshot.id}`).set({
                createdAt: new Date().toISOString(),
                recipient: doc.data().userHandle,
                sender: snapshot.data().userHandle,
                type: 'comment',
                read: false,
                blogId: doc.id
              })
          };
      }).catch((err) => console.error(err));
  });

  exports.onUserImageChange = functions
  .region('asia-east2')
  .firestore.document('/users/{userId}')
  .onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log('image has changed');
      const batch = db.batch();
      return db
        .collection('blogs')
        .where('userHandle', '==', change.before.data().userHandle)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const blog = db.doc(`/blogs/${doc.id}`);
            batch.update(blog, { userImage: change.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else return true;
  });

exports.onBlogDelete = functions
  .region('asia-east2')
  .firestore.document('/blogs/{blogId}')
  .onDelete((snapshot, context) => {
    const blogId = context.params.blogId;
    const batch = db.batch();
    return db
      .collection('comments')
      .where('blogId', '==', blogId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db
          .collection('likes')
          .where('blogId', '==', blogId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection('notifications')
          .where('blogId', '==', blogId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => console.error(err));
  });
