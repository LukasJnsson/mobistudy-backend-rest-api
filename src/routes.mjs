import passport from 'passport'

import usersCtrl from './controllers/usersCtrl.mjs'
import tasksResultsCtrl from './controllers/tasksResultsCtrl.mjs'
import studyStatsCtrl from './controllers/studyStatsCtrl.mjs'

const API_PREFIX = '/api'

// function that sets up the routes
export default async function (app) {

  await usersCtrl.init()

  app.get(API_PREFIX + '/login', passport.authenticate('local', { session: false }), usersCtrl.login.bind(usersCtrl))
  app.post(API_PREFIX + '/sendResetPasswordEmail', usersCtrl.sendPasswordResetEmail.bind(usersCtrl))
  app.post(API_PREFIX + '/resetPassword', usersCtrl.resetPassword.bind(usersCtrl))
  app.post(API_PREFIX + '/users', passport.authenticate('local', { session: false }), usersCtrl.createUser.bind(usersCtrl))
  app.get(API_PREFIX + '/users/renewToken', passport.authenticate('local', { session: false }), usersCtrl.renewToken.bind(usersCtrl))
  app.patch(API_PREFIX + '/users/:userKey', passport.authenticate('local', { session: false }), usersCtrl.updateUser.bind(usersCtrl))
  app.get(API_PREFIX + '/users', passport.authenticate('local', { session: false }), usersCtrl.getUsers.bind(usersCtrl))
  app.get(API_PREFIX + '/users/count', passport.authenticate('local', { session: false }), usersCtrl.getUsersCount.bind(usersCtrl))
  app.get(API_PREFIX + '/users/:user_key', passport.authenticate('local', { session: false }), usersCtrl.getUserByKey.bind(usersCtrl))
  app.delete(API_PREFIX + '/users/:user_key', passport.authenticate('local', { session: false }), usersCtrl.removeUser.bind(usersCtrl))

  await tasksResultsCtrl.init()

  app.get(API_PREFIX + '/tasksResults', passport.authenticate('jwt', { session: false }), tasksResultsCtrl.getAll.bind(tasksResultsCtrl))
  app.post(API_PREFIX + '/tasksResults', passport.authenticate('jwt', { session: false }), tasksResultsCtrl.createNew.bind(tasksResultsCtrl))

  await studyStatsCtrl.init()
  app.get(API_PREFIX + '/studyStats/:study_key', passport.authenticate('jwt', { session: false }), studyStatsCtrl.getLastTasksSummary.bind(studyStatsCtrl))
}
