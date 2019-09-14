const validator = require('validator');
const { db, admin } = require('../util/admin');
const firebase = require('firebase');
const {firebaseConfig} = require('../util/config');
const {reduceUserDetails} = require('../util/performers')

firebase.initializeApp(firebaseConfig)

exports.signup = (req, res) => {
    if(req.method !== 'POST'){
        return res.status(400).json({error: 'method not allowed'});
    }
    const noImg = 'no-img.png';
    const newUser= {
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        userHandle: req.body.userHandle,
        name: req.body.name
    };

    let errors = {};
    if(!validator.isEmail(newUser.email)){
        errors.email = 'Enter valid email';
    }
    else if(validator.isEmpty(newUser.password)){
        errors.password = 'Password cannot be empty';
      }
    else if(newUser.password !== newUser.confirmPassword){
        errors.confirmPassword = 'password and confirrm password does not match';
    }
    else if(validator.isEmpty(newUser.userHandle)){
        errors.userHandle = 'userHandle cannot be empty';
    }
    else if(validator.isEmpty(newUser.name)){
        errors.userHandle = 'name cannot be empty';
    }

    if(Object.keys(errors).length > 0){
        return res.status(400).json(errors);
    }
    //TODO: validate data
    let token, userId;
    db.doc(`users/${newUser.userHandle}`).get().then((doc) => {
        if(doc.exists){
            return res.status(400).json({handle: 'this handle is already taken'})
        }
        else{
            return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password);
            }}).then((data) => {
                userId = data.user.uid;
                return data.user.getIdToken();
            }).then(token1 => {
                token = token1;
                const userCredentials ={
                    userHandle: newUser.userHandle,
                    email: newUser.email,
                    createdAt: new Date().toISOString(),
                    name: newUser.name,
                    imageUrl: `https://firebasestorage.googleapis.com/v0/b/${
                    firebaseConfig.storageBucket
                    }/o/${noImg}?alt=media`,
                    userId
                };
                db.doc(`/follows/${newUser.userHandle}`).set({followers: [], following: []});
                db.doc(`/users/${newUser.userHandle}`).set(userCredentials);
            }).then(() => {
                return res.status(201).json({token})
            }).catch(err => {
                if(err.code === 'auth/email-already-in-use'){
                    return res.status(400).json({email: 'Email already in use'});
                }
                if(err.code === 'auth/weak-password'){
                    return res.status(400).json({password: 'weak password'});
                }
                return res.status(500).json({general: "something went wrong! please try again"})
            })
    };


exports.login = (req, res) => {
    const user = {
        email : req.body.email,
        password: req.body.password,
    }

    const errors = {};

    if(validator.isEmpty(user.password)){
        errors.email = 'must not be empty';
    }
    else if(!validator.isEmail(user.email)){
        errors.email = 'Enter valid email';
    }

    if(Object.keys(errors).length > 0){
        return res.status(401).json({errors})
    }
    firebase.auth().signInWithEmailAndPassword(user.email, user.password).then((data) => {
        return data.user.getIdToken();
    }).then((token) =>{
        return res.json({token});
        }).catch(err => {
        if(err.code === 'auth/user-not-found'){
            return res.status(403).json({general: `you don't have an account yet, sign in first`});
        }
        else if(err.code === 'auth/wrong-password'){
            return res.status(403).json({general: `Incorrect password`});
        }
        else{
            return res.status(500).json({err: err.code})
        }

    })
};

exports.getUserHandle = (req,res) => {
    return res.send(req.user.userHandle);
}


// Upload a profile image for user
exports.uploadImage = (req, res) => {
    let imageUrl;
    const BusBoy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');
    const busboy = new BusBoy({ headers: req.headers });

    let imageToBeUploaded = {};
    let imageFileName;

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
        return res.status(400).json({ error: 'Wrong file type submitted' });
      }
      // my.image.png => ['my', 'image', 'png']
      const imageExtension = filename.split('.')[filename.split('.').length - 1];
      // 32756238461724837.png
      imageFileName = `${req.user.userHandle}.${imageExtension}`;
      const filepath = path.join(os.tmpdir(), imageFileName);
      imageToBeUploaded = { filepath, mimetype };
      file.pipe(fs.createWriteStream(filepath));
    });
    busboy.on('finish', () => {
      admin
        .storage()
        .bucket()
        .upload(imageToBeUploaded.filepath, {
          resumable: false,
          metadata: {
            metadata: {
              contentType: imageToBeUploaded.mimetype
            }
          }
        })
        .then(() => {
          imageUrl = `https://firebasestorage.googleapis.com/v0/b/${
            firebaseConfig.storageBucket
          }/o/${imageFileName}?alt=media`;
          return db.doc(`/users/${req.user.userHandle}`).update({ imageUrl });
        })
        .then(() => {
          return res.send(imageUrl);
        })
        .catch((err) => {
          console.error(err);
          return res.status(500).json({ error: err.code });
        });
    });
    busboy.end(req.rawBody);
  };

  exports.uploadBlogImage = (req, res) => {
      let imageUrl;
      const BusBoy = require('busboy');
      const path = require('path');
      const os = require('os');
      const fs = require('fs');

      const busboy = new BusBoy({ headers: req.headers });

      let imageToBeUploaded = {};
      let imageFileName;

      busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        console.log('file' + file);
        if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
          return res.status(400).json({ error: 'Wrong file type submitted' });
        }
        // my.image.png => ['my', 'image', 'png']
        const imageExtension = filename.split('.')[filename.split('.').length - 1];
        // 32756238461724837.png
        imageFileName = `${req.body.blogId}.${imageExtension}`;
        const filepath = path.join(os.tmpdir(), imageFileName);
        imageToBeUploaded = { filepath, mimetype };
        file.pipe(fs.createWriteStream(filepath));
      });
      busboy.on('finish', () => {
        admin
          .storage()
          .bucket()
          .upload(imageToBeUploaded.filepath, {
            resumable: false,
            metadata: {
              metadata: {
                contentType: imageToBeUploaded.mimetype
              }
            }
          })
          .then(() => {
            imageUrl = `https://firebasestorage.googleapis.com/v0/b/${
              firebaseConfig.storageBucket
            }/o/${imageFileName}?alt=media`;
            return db.doc(`/users/${req.user.userHandle}`).update({ imageUrl });
          })
          .then(() => {
            return res.send(imageUrl);
          })
          .catch((err) => {
            console.error(err);
            return res.status(500).json({ error: err.code });
          });
      });
      busboy.end(req.rawBody);
    };

  exports.addUserDetails = (req, res) => {
      let details = {};
      details = reduceUserDetails(req.body);

      db.doc(`/users/${req.user.userHandle}`).update(details).then(() => {
          return res.json({message: 'details added successfully'})
      }).catch(err => {
          console.error(err);
          return res.status(401).json({error: "something happened"})
      })
  };


  exports.getAuthenticatedUser = (req, res) => {
      let userData = {}
      db.doc(`/users/${req.user.userHandle}`).get().then((doc) => {
          if(doc.exists){
              userData.credentials = doc.data();
              return db.collection('likes').where('userHandle', '==', req.user.userHandle).get();
          }
      }).then(data => {
          userData.likes= [];
          data.forEach(doc => {
              userData.likes.push(doc.data());
          });
          return db.collection(`notifications`).where('recipient', '==', req.user.userHandle).orderBy('createdAt','desc').limit(10).get();
      }).then(data => {
          userData.notifications= [];
          data.forEach(doc => {
              if(doc.data().sender!== req.user.userHandle){
                userData.notifications.push({
                    recipient: doc.data().recipient,
                    sender: doc.data().sender,
                    createdAt: doc.data().createdAt,
                    type: doc.data().type,
                    blogId: doc.data().blogId,
                    read: doc.data().read,
                    notifications: doc.id
                });
              }
          });
            return db.doc(`follows/${req.user.userHandle}`).get();
        }).then(doc => {
              userData.follows = {
                followers:doc.data().followers,
                following:doc.data().following
              };
            return res.json(userData);
          })
      .catch(err =>{
          console.error(err);
          return res.status(500).json({error: 'something happened while fetchin user credentials'});
      })
  };


exports.getUserDetails = (req, res) => {
    let userData = {};
    db.doc(`users/${req.params.userHandle}`).get().then((doc) => {
        if(doc.exists){
            userData.user = doc.data();
            return db.collection(`blogs`).where('userHandle', '==', req.params.userHandle).orderBy('createdAt', 'desc').get();
        }
        else {
            return res.status(404).json({ errror: 'User not found' });
        }
    }).then((docs) => {
        userData.blogs = [];
        docs.forEach((doc => {
            userData.blogs.push({
                ...doc.data(),
                blogId: doc.id
            });
        })

      );
        return db.doc(`follows/${req.params.userHandle}`).get();
    }).then(doc => {
        userData.follows = {};
        userData.follows = doc.data();
        return res.json(userData);
    }).catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
};


exports.markNotificationsRead = (req, res) => {
    let batch = db.batch();
    req.body.forEach((notificationId) => {
      const notification = db.doc(`/notifications/${notificationId}`);
      batch.update(notification, { read: true });
    });
    batch
      .commit()
      .then(() => {
        return res.json({ message: 'Notifications marked read' });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  };

exports.followUser = (req, res) => {
  let batch = db.batch();
  const recipient = req.body.recipient;
  const sender = db.doc(`follows/${req.user.userHandle}`);
  batch.update(sender, {following:admin.firestore.FieldValue.arrayUnion(recipient)});
  const receiver = db.doc(`follows/${recipient}`);
  batch.update(receiver, {followers:admin.firestore.FieldValue.arrayUnion(req.user.userHandle)});
  return batch.commit().then(() => res.send('You started following ' + recipient + '!')
  ).catch((err) => {
    console.error(err);
    return res.status(500).json({ error: err.code });
  });
}



exports.unfollowUser = (req, res) => {
  let batch = db.batch();
  const recipient = req.body.recipient;
  const sender = db.doc(`follows/${req.user.userHandle}`);
  batch.update(sender, {following:admin.firestore.FieldValue.arrayRemove(recipient)});
  const receiver = db.doc(`follows/${recipient}`);
  batch.update(receiver, {followers:admin.firestore.FieldValue.arrayRemove(req.user.userHandle)});
  return batch.commit().then(() => res.send('You unfollowed ' + recipient + '!')
  ).catch((err) => {
    console.error(err);
    return res.status(500).json({ error: err.code });
  });
}
  exports.getFamousUser = (req, res) => {
    let users = [];
    let famousBlogs = [];
    let promises= [];
    let follows =[];
    db.collection('blogs').orderBy('likeCount','desc').limit(5).get().then(data => {
      data.forEach(doc => {
        famousBlogs.push(doc.data());
        promises.push(db.doc(`/users/${doc.data().userHandle}`).get());
      });

    Promise.all(promises).then((snapshots) => {
    snapshots.forEach((querySnapshot) => {
        let exist = false;
        users.forEach(user => {
          if(user.userHandle === querySnapshot.data().userHandle)
            exist=true;
        })
        !exist && users.push(querySnapshot.data());
    });
    res.send(users);
  })
  }).catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
}

exports.getFollows = (req, res) => {
  db.doc(`follows/${req.user.userHandle}`).get().then((doc) => {
      res.json(doc.data());
  }).catch((err) => {
    console.error(err);
    return res.status(500).json({ error: err.code });
  });
}

exports.getFollowsOf = (req, res) => {
  db.doc(`follows/${req.params.userHandle}`).get().then((doc) => {
      res.json(doc.data());
  }).catch((err) => {
    console.error(err);
    return res.status(500).json({ error: err.code });
  });
}
