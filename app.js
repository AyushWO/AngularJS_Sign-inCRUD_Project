let app = angular.module("contactApp", ["ngRoute", "ui.bootstrap"]);

app.config(function ($routeProvider) {
  $routeProvider
    .when("/sign-in", {
      templateUrl: "sign-in.html",
      controller: "SignInController",
    })
    .when("/sign-up", {
      templateUrl: "sign-up.html",
      controller: "SignUpController",
    })
    .when("/contact-list", {
      templateUrl: "contact-list.html",
      controller: "ContactListController",
      resolve: {
        loginCheck: function (AuthService) {
          AuthService.requireLogin();
        },
      },
      authenticate: true,
    })
    .when("/add-edit-contact", {
      templateUrl: "add-edit-contact.html",
      controller: "AddEditContactController",
      resolve: {
        loginCheck: function (AuthService) {
          AuthService.requireLogin();
        },
      },
      authenticate: true,
    })
    .otherwise({ redirectTo: "/sign-in" });
});

app.run(function ($rootScope, $location, AuthService, UserService) {
  AuthService.isLoggedIn();

  if (AuthService.isLoggedIn()) {
    let loggedInUserEmail = localStorage.getItem("loggedInUserEmail");
    if (loggedInUserEmail) {
      UserService.setCurrentUser(loggedInUserEmail);
    }
  }

  $rootScope.$on("$routeChangeStart", function (next) {
    if (
      next.$$route &&
      next.$$route.authenticate &&
      !AuthService.isLoggedIn()
    ) {
      $location.path("/sign-in");
    }
    if (
      next.$$route &&
      next.$$route.originalPath === "/sign-in" &&
      AuthService.isLoggedIn()
    ) {
      $location.path("/contact-list");
    }

    if (AuthService.isLoggedIn()) {
      UserService.setCurrentUserContacts();
    }
  });
});

app.controller(
  "SignInController",
  function ($scope, $location, UserService, AuthService) {
    $scope.signInData = {};
    $scope.error = "";

    $scope.signIn = function () {
      let foundUser = UserService.signIn(
        $scope.signInData.email,
        $scope.signInData.password
      );
      if (foundUser) {
        $location.path("/contact-list");
      } else {
        $scope.error = "Invalid email or password. Please try again.";
      }
    };

    $scope.goToSignUp = function () {
      $location.path("/sign-up");
    };
  }
);

app.controller("SignUpController", function ($scope, $location, UserService) {
  $scope.signUpData = {};
  $scope.error = "";
  $scope.passwordsMatchError = false;

  $scope.signUp = function () {
    if (!$scope.signUpData.email || !$scope.signUpData.password) {
      $scope.error = "Email and password are required.";
      return;
    }

    if ($scope.signUpData.password !== $scope.signUpData.confirmPassword) {
      $scope.passwordsMatchError = true;
      return;
    }

    let success = UserService.signUp(
      $scope.signUpData.email,
      $scope.signUpData.password
    );
    if (success) {
      $location.path("/sign-in");
    } else {
      $scope.error = "Email already exists. Please choose a different email.";
    }
  };

  $scope.goToSignIn = function () {
    $location.path("/sign-in");
  };
});

// app.controller(
//   "ContactListController",
//   function ($scope, $location, UserService, AuthService, $http) {
//     $scope.contacts = UserService.getCurrentUserContacts();

//     $scope.logOut = function () {
//       AuthService.logOut();
//       $location.path("/sign-in");
//     };

//     $scope.editContact = function (contact) {
//       UserService.setCurrentContact(contact);
//       $location.path("/add-edit-contact");
//     };

//     $scope.deleteContact = function (contact) {
//       UserService.deleteContact(contact);
//     };

//     $scope.exportData = function () {
//       alasql('SELECT * INTO XLSX("contact.xlsx",{headers:true}) FROM ?', [
//         UserService.getCurrentUserContacts(),
//       ]);
//     };
//   }
// );

app.controller(
  "ContactModalController",
  function ($scope, $uibModalInstance, UserService, contact) {
    $scope.contact = angular.copy(contact);

    $scope.saveContact = function () {
      UserService.saveContact($scope.contact, true);
      $uibModalInstance.close("saved");
    };

    $scope.deleteContact = function () {
      UserService.deleteContact($scope.contact);
      $uibModalInstance.close("deleted");
    };

    $scope.cancel = function () {
      $uibModalInstance.dismiss("cancel");
    };
  }
);

app.controller(
  "ContactListController",
  function ($scope, $location, UserService, AuthService, $uibModal) {
    $scope.contacts = UserService.getCurrentUserContacts();

    $scope.logOut = function () {
      AuthService.logOut();
      $location.path("/sign-in");
    };

    $scope.editContact = function (contact) {
      UserService.setCurrentContact(contact);
      $location.path("/add-edit-contact");
    };

    $scope.deleteContact = function (contact) {
      UserService.deleteContact(contact);
    };

    $scope.exportData = function () {
      alasql('SELECT * INTO XLSX("contact.xlsx",{headers:true}) FROM ?', [
        UserService.getCurrentUserContacts(),
      ]);
    };

    $scope.openModal = function (contact) {
      var modalInstance = $uibModal.open({
        templateUrl: "contact-modal.html",
        controller: "ContactModalController",
        resolve: {
          contact: function () {
            return contact;
          },
        },
      });

      modalInstance.result.then(
        function (result) {
          // todo: handle modal result
        },
        function () {
          // todo: modal dismissed
        }
      );
    };
  }
);

app.controller(
  "AddEditContactController",
  function ($scope, $location, UserService, AuthService) {
    $scope.contact = {};
    $scope.editing = false;

    let currentContact = UserService.getCurrentContact();
    if (currentContact) {
      $scope.contact = angular.copy(currentContact);
      $scope.editing = true;
      UserService.clearCurrentContact();
    }

    $scope.saveContact = function () {
      UserService.saveContact($scope.contact, $scope.editing);
      $location.path("/contact-list");
    };

    $scope.editContact = function (contact) {
      $scope.contact = angular.copy(contact);
      $scope.editing = true;
      $location.path("/add-edit-contact").search({ id: contact.id });
    };

    $scope.logOut = function () {
      AuthService.logOut();
      $location.path("/sign-in");
    };

    $scope.setImage = function (element) {
      let reader = new FileReader();
      reader.onload = function (e) {
        $scope.$apply(function () {
          $scope.contact.image = e.target.result;
        });
      };
      reader.readAsDataURL(element.files[0]);
    };
  }
);

app.service("UserService", function (AuthService) {
  let users = JSON.parse(localStorage.getItem("users")) || [];
  let currentUser = JSON.parse(localStorage.getItem("currentUser")) || null;
  let currentContact =
    JSON.parse(localStorage.getItem("currentContact")) || null;

  function saveUsers() {
    localStorage.setItem("users", JSON.stringify(users));
  }

  function getUserByEmail(email) {
    return users.find((user) => user.email === email);
  }

  return {
    signIn: function (email, password) {
      let user = getUserByEmail(email);
      if (user && user.password === password) {
        currentUser = user;
        AuthService.logIn();
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        return true;
      }
      return false;
    },

    signUp: function (email, password) {
      if (getUserByEmail(email)) {
        return false;
      }
      users.push({ email: email, password: password, contacts: [] });
      saveUsers();
      return true;
    },

    getCurrentUserContacts: function () {
      return currentUser ? currentUser.contacts : [];
    },

    saveContact: function (contact, editing) {
      if (!currentUser) return;

      if (!editing) {
        contact.id = Date.now().toString();
        currentUser.contacts.push(contact);
      } else {
        let existingContactIndex = currentUser.contacts.findIndex(
          (c) => c.id === contact.id
        );
        if (existingContactIndex !== -1) {
          currentUser.contacts[existingContactIndex] = contact;
        }
      }
      saveUsers();
    },

    deleteContact: function (contact) {
      if (!currentUser) return;

      let index = currentUser.contacts.indexOf(contact);
      if (index !== -1) {
        currentUser.contacts.splice(index, 1);
        saveUsers();
      }
    },

    setCurrentContact: function (contact) {
      currentContact = contact;
      localStorage.setItem("currentContact", JSON.stringify(currentContact));
    },

    getCurrentContact: function () {
      return currentContact;
    },

    clearCurrentContact: function () {
      currentContact = null;
      localStorage.removeItem("currentContact");
    },

    setCurrentUser: function (email) {
      currentUser = getUserByEmail(email);
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
    },

    setCurrentUserContacts: function () {
      if (currentUser) {
        currentUser = getUserByEmail(currentUser.email);
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
      }
    },
  };
});

app.service("AuthService", function ($location) {
  let loggedIn = localStorage.getItem("loggedIn") === "true";

  return {
    isLoggedIn: function () {
      loggedIn = localStorage.getItem("loggedIn") === "true";
      return loggedIn;
    },
    logIn: function () {
      loggedIn = true;
      localStorage.setItem("loggedIn", "true");
    },
    logOut: function () {
      loggedIn = false;
      localStorage.setItem("loggedIn", "false");
    },
    requireLogin: function () {
      if (!loggedIn) {
        $location.path("/sign-in");
      }
    },
  };
});

app.directive("contactCard", function () {
  return {
    restrict: "EA",
    templateUrl: "contact-card.html",
    scope: {
      contact: "=",
    },
    link: function (scope, element) {
      element.on("dblclick", function () {
        scope.$apply(function () {
          scope.openModal(scope.contact);
        });
      });
    },
  };
});
